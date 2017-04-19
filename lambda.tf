resource "aws_lambda_permission" "allow_bucket" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.email_forwarder.arn}"
  principal     = "s3.amazonaws.com"
  source_arn    = "${aws_s3_bucket.mails.arn}"
}

resource "aws_lambda_function" "email_forwarder" {
    filename         = "lambda/email_forwarder.zip"
    function_name    = "email_forwarder"
    role             = "${aws_iam_role.iam_for_lambda.arn}"
    handler          = "index.handler"
    source_code_hash = "${base64sha256(file("lambda/email_forwarder.zip"))}"
    runtime          = "nodejs4.3"
    timeout          = 60

    environment {
        variables = {
            FROM_EMAIL    = "${var.email_from}",
            TO_SUFFIX     = "${var.email_to}",
            SLACK_PATH    = "${var.slack_path}",
            SLACK_CHANNEL = "${var.slack_channel}",
            SLACK_USER    = "${var.slack_user_name}",
            SLACK_ICON    = "${var.slack_icon_emoji}",
        }
    }
}