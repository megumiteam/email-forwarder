resource "aws_route53_zone" "public" {
    name       = "${var.domain}."
    comment    = ""
    force_destroy = false

    tags {
    }
}

resource "aws_route53_record" "MX" {
    zone_id = "${aws_route53_zone.public.id}"
    name    = "${var.domain}"
    type    = "MX"
    ttl     = "600"
    records = ["10 inbound-smtp.${var.region}.amazonaws.com"]
}

resource "aws_route53_record" "amazonses_verification_record" {
    zone_id = "${aws_route53_zone.public.id}"
    name    = "_amazonses.${var.domain}"
    type    = "TXT"
    ttl     = "600"
    records = ["${aws_ses_domain_identity.domain.verification_token}"]
}
