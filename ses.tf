resource "aws_ses_domain_identity" "domain" {
  domain = "${var.domain}"
}

resource "aws_ses_receipt_rule" "receive" {
  name          = "receive-${var.domain}"
  rule_set_name = "default-rule-set"
  recipients    = ["${var.domain}"]
  enabled       = true
  scan_enabled  = true

  s3_action {
    bucket_name = "${aws_s3_bucket.mails.id}"
    position    = "${var.ses_receipt_rule_position}"
  }
}