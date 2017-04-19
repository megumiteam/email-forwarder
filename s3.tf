resource "aws_s3_bucket" "mails" {
    bucket = "mails.${var.domain}"
    acl    = "private"
    policy = <<POLICY
{
    "Version": "2008-10-17",
    "Statement": [
        {
            "Sid": "GiveSESPermissionToWriteEmail",
            "Effect": "Allow",
            "Principal": {
                "Service": [
                    "ses.amazonaws.com"
                ]
            },
            "Action": [
                "s3:PutObject"
            ],
            "Resource": "arn:aws:s3:::mails.${var.domain}/*",
            "Condition": {
                "StringEquals": {
                    "aws:Referer": "${data.aws_caller_identity.current.account_id}"
                }
            }
        }
    ]
}
POLICY
}

resource "aws_s3_bucket_notification" "bucket_notification" {
  bucket = "${aws_s3_bucket.mails.id}"

  lambda_function {
    lambda_function_arn = "${aws_lambda_function.email_forwarder.arn}"
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = ""
    filter_suffix       = ""
  }
}