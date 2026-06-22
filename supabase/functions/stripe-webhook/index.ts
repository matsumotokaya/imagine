import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
})

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('No signature', { status: 400 })
  }

  try {
    const body = await req.text()
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not set')
    }

    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Helper: resolve user_id from subscription metadata or stripe_customer_id
    const resolveUserId = async (subscription: Stripe.Subscription): Promise<string | null> => {
      // Try metadata first
      if (subscription.metadata?.user_id) {
        return subscription.metadata.user_id
      }

      // Fallback: look up by stripe_customer_id
      const customerId = subscription.customer as string
      if (customerId) {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (data?.id) {
          console.log(`Resolved user ${data.id} via stripe_customer_id ${customerId}`)
          return data.id
        }
      }

      return null
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // Only subscription checkouts grant premium. One-time payments
        // (mode === 'payment'), e.g. the whatif wallpaper purchases that share
        // this Stripe account, must NOT upgrade the user to premium.
        if (session.mode !== 'subscription') {
          console.log(`Ignoring non-subscription checkout (mode=${session.mode}) ${session.id}`)
          break
        }

        const userId = session.client_reference_id || session.metadata?.user_id

        if (!userId) {
          console.error('No user_id found in session')
          break
        }

        // Calculate subscription expiration (30 days from now)
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 30)

        // Update user profile to premium
        const { error } = await supabase
          .from('profiles')
          .update({
            subscription_tier: 'premium',
            subscription_expires_at: expiresAt.toISOString(),
            stripe_customer_id: session.customer as string,
            subscription_status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)

        if (error) {
          console.error('Error updating profile:', error)
        } else {
          console.log(`User ${userId} upgraded to premium`)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = await resolveUserId(subscription)

        if (!userId) {
          console.error('No user_id found in subscription metadata or by customer_id')
          break
        }

        const expiresAt = new Date(subscription.current_period_end * 1000)

        // Determine subscription status
        let subscriptionStatus: 'active' | 'canceling' | 'canceled'
        if (subscription.cancel_at_period_end) {
          subscriptionStatus = 'canceling'
        } else if (subscription.status === 'active') {
          subscriptionStatus = 'active'
        } else {
          subscriptionStatus = 'canceled'
        }

        const { error } = await supabase
          .from('profiles')
          .update({
            subscription_tier: subscription.status === 'active' ? 'premium' : 'free',
            subscription_expires_at: expiresAt.toISOString(),
            subscription_status: subscriptionStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)

        if (error) {
          console.error('Error updating subscription:', error)
        } else {
          console.log(`Subscription updated for user ${userId} with status ${subscriptionStatus}`)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = await resolveUserId(subscription)

        if (!userId) {
          console.error('No user_id found in subscription metadata or by customer_id')
          break
        }

        // Downgrade to free tier
        const { error } = await supabase
          .from('profiles')
          .update({
            subscription_tier: 'free',
            subscription_expires_at: null,
            subscription_status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)

        if (error) {
          console.error('Error downgrading user:', error)
        } else {
          console.log(`User ${userId} downgraded to free`)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Webhook error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
