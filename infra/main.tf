# Tier 0.5 evidence: an integration that exists in infrastructure before it
# exists in application code. Nomos must detect the Stripe relationship here
# even though this file imports no SDK.
#
# Nothing in this file is applied by CI. It exists so the infrastructure-as-code
# detector has something real to read.

terraform {
  required_version = ">= 1.6"

  required_providers {
    stripe = {
      source  = "lukasaron/stripe"
      version = "3.2.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.82.0"
    }
  }
}

provider "stripe" {
  # Referenced by name only. The value lives in the secret store, never here.
  api_key = var.stripe_secret_key
}

provider "aws" {
  region = var.aws_region
}

variable "stripe_secret_key" {
  description = "Stripe restricted API key for webhook management"
  type        = string
  sensitive   = true
}

variable "aws_region" {
  description = "Region hosting the checkout service"
  type        = string
  default     = "us-east-1"
}

# The webhook endpoint Stripe delivers to. A change to Stripe's webhook API
# affects this resource as much as it affects src/app.ts.
resource "stripe_webhook_endpoint" "checkout_events" {
  url = "https://checkout.example.com/webhooks/stripe"

  enabled_events = [
    "checkout.session.completed",
    "customer.subscription.deleted",
    "invoice.payment_failed",
  ]
}

resource "stripe_price" "demo_plan_monthly" {
  currency    = "usd"
  unit_amount = 1500

  recurring {
    interval = "month"
  }
}

data "aws_secretsmanager_secret" "stripe_credentials" {
  name = "prod/checkout/stripe"
}
