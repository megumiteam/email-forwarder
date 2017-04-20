# email-forwarder
Terraform を使って、AWS 上に Email の受信・転送・Slack通知を実行するための環境を AWS に作成するためのプロダクトです。

## 機能
- SES でのメール受信と S3 へのメール保存
- S3 に保存したメールを指定されたメールアドレスに転送
- ついでに Slack に投稿
- ついでに受信したメールが ACM の apploval メールだったら勝手に承認

SESレシーブルールの作成も、R53の設定も、Lambda の作成も terraform apply だけで完結します。
手作業でやらなくてはいけないのは、SES の送信Eメールの登録・承認と Slack の incomming web hook の作成だけ。

新規で取得したドメインでメール受信の設定とかするのめんどくさかったんだけど、これ使えば既存のメールアドレスに受信したメールを転送してくれるようになるので、いきなり楽チンになります。

## 使用にあたって
既存のリソースへの影響がないかの確認を行うためには `terraform plan` で確認を忘れずにお願いします。

### Route53 使用上の注意
既存のドメインに適用する場合は、まず以下のコマンドで Route53 Hosted Zone を Terrahome 管理下においてください。

```bash
$ terraform import resource aws_route53_zone.public {__ZONE_ID__}
```

これやらないと、新規で Route53 zone 作っちゃうので。

### SES 送信 Eメール作成
SES の送信Eメールの登録・承認は、手動で行っておく必要があります。
作成した送信Eメールは `${var.email_from}` にセットしてください。

### ACM の自動承認について
一応、Approval メール本文内のアカウントIDと Lambda が実行されている AWS Account ID を比較して同じだったら自動承認するようにしています。

## apply

`terraform apply` すると、幾つかの変数の入力を要求します。
あらかじめ terraform.tfvars を作っておくといいでしょう。
サンプル

```text:terraform.tfvars
"domain"     = "example.com"
"region"     = "us-east-1"

"email_from" = "wokamoto@example.com"
"email_to"   = "wokamoto@example.com"

"slack_path"       = "/services/XXXXXXXXX/XXXXXXXXX/XXXXXXXXXXXXXXXXXXXXXXXX"
"slack_channel"    = "#test"
"slack_icon_emoji" = ":ses:"

"ses_receipt_rule_position" = 1
```

#### email_from
SES を使ってメール転送するときの From として使用するメールアドレスです。
事前に SES 送信Eメールとして登録・承認しておいてください。

#### email_to
転送先のメールアドレスです。

#### slack_path, slack_channel, slack_user_name, slack_icon_emoji
Slack incoming Webhook ようの情報です。

#### ses_receipt_rule_position
SES 受信ルールの default-rule-set に受信ルールを追加するので、すでに受信ルールが登録されている場合は最後の数字+1を設定してください。
何も受信ルールが設定されていない場合は 1 でいいです。
