variable "domain" {}

variable "region" { default = "us-east-1" }

variable "email_from" {}
variable "email_to"   {}

variable "slack_path"       {}
variable "slack_channel"    { default = "#general" },
variable "slack_user_name"  { default = "Mail from SES" },
variable "slack_icon_emoji" { default = ":incoming_envelope:" }

variable "ses_receipt_rule_position" { default = 1 }

provider "aws" {
    region = "${var.region}"
}

provider "aws" {
    region = "us-east-1"
    alias  = "virginia"
}

data "aws_caller_identity" "current" {}

output "account_id" {
  value = "${data.aws_caller_identity.current.account_id}"
}
output "domain" {
  value = "${var.domain}"
}
output "email_to" {
  value = "${var.email_to}"
}