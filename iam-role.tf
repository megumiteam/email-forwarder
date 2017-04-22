resource "aws_iam_role" "iam_for_lambda" {
  name = "iam_for_email_forwarder-${var.region}-${var.domain}"

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
EOF
}

resource "aws_iam_policy" "s3_mails_read" {
    name        = "S3ReadOnly-${var.region}-${aws_s3_bucket.mails.id}"
    description = ""
    policy      = <<POLICY
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect":"Allow",
            "Action":[
                "s3:ListAllMyBuckets"
            ],
            "Resource":"arn:aws:s3:::*"
        },
        {
            "Effect":"Allow",
            "Action":[
                "s3:ListBucket",
                "s3:GetBucketLocation"
            ],
            "Resource":"arn:aws:s3:::${aws_s3_bucket.mails.id}"
        },
        {
            "Effect":"Allow",
            "Action":[
                "s3:GetObject"
            ],
            "Resource":"arn:aws:s3:::${aws_s3_bucket.mails.id}/*"
        }
    ]
}
POLICY
}

resource "aws_iam_role_policy_attachment" "s3_mails_read" {
    role       = "${aws_iam_role.iam_for_lambda.name}"
    policy_arn = "${aws_iam_policy.s3_mails_read.arn}"
}

resource "aws_iam_policy" "send_email" {
    name        = "SESSendMail-${var.region}-${var.domain}"
    description = ""
    policy      = <<POLICY
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "ses:SendBounce",
                "ses:SendEmail",
                "ses:SendRawEmail"
            ],
            "Resource": [
                "*"
            ],
            "Effect": "Allow"
        }
    ]
}
POLICY
}

resource "aws_iam_role_policy_attachment" "send_email" {
    role       = "${aws_iam_role.iam_for_lambda.name}"
    policy_arn = "${aws_iam_policy.send_email.arn}"
}

resource "aws_iam_role_policy_attachment" "put_log_events" {
    role       = "${aws_iam_role.iam_for_lambda.name}"
    policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}