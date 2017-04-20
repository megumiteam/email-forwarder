/*
Name: Email Forwarder
*/
'use strict';

exports.handler = function(event, context) {
    const config = {
        fromEmail:      process.env.FROM_EMAIL,
        toEmailSuffix:  process.env.TO_SUFFIX,
        slack: {
            hostname:   'hooks.slack.com',
            path:       process.env.SLACK_PATH,
            channel:    process.env.SLACK_CHANNEL,
            username:   process.env.SLACK_USER,
            icon_emoji: process.env.SLACK_ICON,
            color:      'good'
        }
    };

    const aws = require('aws-sdk');
    const async = require('async');
    const cheerio = require('cheerio');
    const https = require('https');
    const util = require('util');

    const bucket = event.Records[0].s3.bucket.name;
    const key = event.Records[0].s3.object.key;
    var mailObject;

    async.waterfall([
        function(nextProcess) {
            // get email source
            let s3 = new aws.S3({apiVersion: '2006-03-01'});
            s3.getObject({Bucket:bucket, Key:key}, nextProcess);
        },
        function(data, nextProcess) {
            // parsing email
            let MailParser = require('mailparser').MailParser;
            let mailparser = new MailParser();

            // setup an event listener when the parsing finishes
            mailparser.on('end', (result) => {
                mailObject = result;
                console.log('Receive Mail: %j', mailObject);    // eslint-disable-line
                nextProcess(null, {
                    Object: result,
                    Raw: data.Body.toString()
                });
            });

            // send the email source to the parser
            mailparser.write(data.Body.toString());
            mailparser.end();
        },
        function(email, nextProcess) {
            // transform recipients
            let newRecipients = [],
                originalRecipient;
            async.each(email.Object.to,
                function(recipient, nextLoop){
                    originalRecipient = recipient.address;
                    newRecipients = newRecipients.concat(
                        recipient.address.replace(/^([^@]+)@([^\.]+)(\..*)$/, config.toEmailSuffix)
                    );
                    nextLoop();
                },
                function complete(err) {
                    if (err)
                        nextProcess(err);
                    else
                        nextProcess(null, {
                            Object:     email.Object,
                            Data:       email.Raw,
                            Recipients: newRecipients,
                            Source:     originalRecipient
                        });
                }
            );
        },
        function(email, nextProcess) {
            // transform mail headers
            let match = email.Data.match(/^((?:.+\r?\n)*)(\r?\n(?:.*\s+)*)/m);
            let header = match && match[1] ? match[1] : email.Data;
            let body = match && match[2] ? match[2] : '';
            let from = email.Object.from && email.Object.from[0] ? email.Object.from[0].address : '';

            // Add "Reply-To:" with the "From" address if it doesn't already exists
            if (!/^Reply-To:\s/m.test(header)) {
                if (from) {
                    header = header + 'Reply-To: ' + from + '\r\n';
                    console.log('Added Reply-To address of: ' + from);    // eslint-disable-line
                } else {
                    console.log('Reply-To address not added because From address was not properly extracted.');    // eslint-disable-line
                }
            }

            // SES does not allow sending messages from an unverified address,
            // so replace the message's "From:" header with the original
            // recipient (which is a verified domain)
            header = header.replace(
                /^From:\s(.*)/mg,
                function(match, from) {
                    return 'From: ' + from.replace(/<(.*)>/, '').trim() + ' <' + config.fromEmail + '>';
                }
            );

            // Remove the Return-Path header.
            header = header.replace(/^Return-Path:\s(.*)\r?\n/mg, '');

            // Remove Sender header.
            header = header.replace(/^Sender:\s(.*)\r?\n/mg, '');

            // Remove all DKIM-Signature headers to prevent triggering an
            // "InvalidParameterValue: Duplicate header 'DKIM-Signature'" error.
            // These signatures will likely be invalid anyways, since the From
            // header was modified.
            header = header.replace(/^DKIM-Signature:\s.*\r?\n(\s+.*\r?\n)*/mg, '');

            nextProcess(null, {
                Object:     email.Object,
                Data:       header + body,
                Recipients: email.Recipients,
                Source:     email.Source
            });
        },
        function(email, nextProcess) {
            // Email Forwarding
            let ses = new aws.SES();
            let params = {
                Destinations: email.Recipients,
                Source:       email.Source,
                RawMessage: {
                    Data: email.Data
                }
            };
            //console.log('params: %j', params);    // eslint-disable-line
            ses.sendRawEmail(params, nextProcess);
        },
        function(result, nextProcess) {
            // post to slack
            if (config.slack.path) {
                let params = {
                    method:     'POST',
                    hostname:   config.slack.hostname,
                    port:       443,
                    path:       config.slack.path
                };
                let postData = {
                    'channel':      config.slack.channel,
                    'username':     config.slack.username,
                    'text':
                        'Subject: ' + mailObject.subject + '\n' +
                        'From: '    + mailObject.from[0].name + '(' + mailObject.from[0].address + ')' + '\n' +
                        'To: '      + mailObject.to[0].address,
                    'icon_emoji':   config.slack.icon_emoji
                };
                postData.attachments = [{
                    'color':    config.slack.color,
                    'text':     mailObject.text
                }];
    
                let req = https.request(params, (res) => {
                    nextProcess(null, res);
                });
                req.on('error', (err) => {
                    console.log('problem with request (Slack): ' + err.message);    // eslint-disable-line
                    nextProcess(err);
                });
                req.write(util.format('%j', postData));
                req.end();
            } else {
                nextProcess(null, result);
            }
        },
        function(result, nextProcess) {
            // Get ACM Approval URL
            let from = mailObject && mailObject.from ? mailObject.from : [{address: '', 'name': ''}],
                to = mailObject && mailObject.to ? mailObject.to : [{address: '', 'name': ''}],
                subject = mailObject && mailObject.subject ? mailObject.subject : '';
            let mailInfo = {
                from: from,
                to: to,
                subject: subject
            };
            if (from[0].address === 'no-reply@certificates.amazon.com' && /^administrator/.test(to[0].address) && /^Certificate approval/.test(subject)) {
                let $ = cheerio.load(mailObject.html);
                let approvalUrl = $('a#approval_url').attr('href');
                let aws_account_id = process.env.AWS_ACCOUNT_ID;
                let regexp = new RegExp(aws_account_id.replace(/(\d{4})(\d{4})(\d{4})/,'$1-$2-$3'));
                if ($('td').text().match(regexp)) {
                    mailInfo.ACMApprovalUrl = approvalUrl;
                }
            }
            nextProcess(null, mailInfo);
        },
        function(result, nextProcess) {
            if (result.ACMApprovalUrl) {
                // Get ACM Approval Form
                let body;
                console.log('ACM Approval Url: %j', result.ACMApprovalUrl);    // eslint-disable-line
                https.get(result.ACMApprovalUrl, (res) => {
                    res.on('data', (chunk) => {
                        body += chunk;
                    });
                    res.on('end', (res) => {
                        nextProcess(null, {
                            ACMApprovalUrl: result.ACMApprovalUrl,
                            ACMApprovalBody: body,
                            response: res
                        });
                    });
                }).on('error', (err) => {
                    nextProcess(err);
                });
            } else {
                nextProcess(null, result);
            }
        },
        function(result, nextProcess) {
            if (result.ACMApprovalBody) {
                // ACM Approval
                let $ = cheerio.load(result.ACMApprovalBody);
                let url = require('url');
                let u = url.parse(result.ACMApprovalUrl, false);
                let params = {
                    method:     'POST',
                    hostname:   u.host,
                    port:       443,
                    path:       $('form').attr('action')
                };

                let postData = {};
                async.eachSeries($('form').serializeArray(),
                    function(input, nextLoop){
                        postData[input.name] = input.value;
                        nextLoop();
                    },
                    (err) => {
                        if (err) {
                            nextProcess(err);
                        } else {
                            console.log('Approval post data: %j', postData);    // eslint-disable-line
                            let req = https.request(params, (res) => {
                                nextProcess(null, res);
                            });
                            req.on('error', (err) => {
                                console.log('problem with request (ACM Approval): ' + err.message);    // eslint-disable-line
                                nextProcess(err);
                            });
                            req.write(util.format('%j', postData));
                            req.end();
                        }
                    }
                );
            } else {
                nextProcess(null, result);
            }
        }],
        (err, res) => {
            if (err) {
                console.log('err: %j', err);    // eslint-disable-line
                context.fail(err);
            } else {
                console.log('result: %j', res); // eslint-disable-line
                context.succeed('Success!');
            }
        }
    );
};
