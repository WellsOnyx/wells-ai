/**
 * Wells AI - Payment Methods API
 * Manage customer payment methods
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { withValidation } from '@/lib/validation'
import {
  getOrCreateCustomer,
  listPaymentMethods,
  attachPaymentMethod,
  detachPaymentMethod,
  setDefaultPaymentMethod
} from '@/lib/stripe'

// ===== GET - List Payment Methods =====

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { errorCode: 'UNAUTHORIZED', message: 'You must be signed in' },
        { status: 401 }
      )
    }

    // Get or create customer
    const customer = await getOrCreateCustomer(userId)

    // Get payment methods
    const paymentMethods = await listPaymentMethods(customer.id)

    // Format payment methods
    const formattedMethods = paymentMethods.map((pm) => ({
      id: pm.id,
      type: pm.type,
      card: pm.card ? {
        brand: pm.card.brand,
        last4: pm.card.last4,
        exp_month: pm.card.exp_month,
        exp_year: pm.card.exp_year
      } : undefined,
      isDefault: customer.invoice_settings?.default_payment_method === pm.id
    }))

    return NextResponse.json({
      success: true,
      paymentMethods: formattedMethods
    })

  } catch (error: any) {
    console.error('Error listing payment methods:', error)
    return NextResponse.json(
      { errorCode: 'FETCH_ERROR', message: error.message },
      { status: 500 }
    )
  }
}

// ===== POST - Add Payment Method =====

const addPaymentMethodSchema = z.object({
  paymentMethodId: z.string().min(1)
})

export const POST = withValidation(
  addPaymentMethodSchema,
  async (request) => {
    try {
      const { userId } = await auth()

      if (!userId) {
        return NextResponse.json(
          { errorCode: 'UNAUTHORIZED', message: 'You must be signed in' },
          { status: 401 }
        )
      }

      const { paymentMethodId } = request.validatedBody as z.infer<typeof addPaymentMethodSchema>

      // Get or create customer
      const customer = await getOrCreateCustomer(userId)

      // Attach payment method
      const paymentMethod = await attachPaymentMethod(paymentMethodId, customer.id)

      // If this is the first payment method, set it as default
      const existingMethods = await listPaymentMethods(customer.id)
      if (existingMethods.length === 1) {
        await setDefaultPaymentMethod(customer.id, paymentMethod.id)
      }

      return NextResponse.json({
        success: true,
        paymentMethod: {
          id: paymentMethod.id,
          type: paymentMethod.type,
          card: paymentMethod.card ? {
            brand: paymentMethod.card.brand,
            last4: paymentMethod.card.last4,
            exp_month: paymentMethod.card.exp_month,
            exp_year: paymentMethod.card.exp_year
          } : undefined
        }
      })

    } catch (error: any) {
      console.error('Error adding payment method:', error)
      return NextResponse.json(
        { errorCode: 'ADD_ERROR', message: error.message },
        { status: 500 }
      )
    }
  }
)

// ===== PATCH - Update Payment Method =====

const updatePaymentMethodSchema = z.object({
  paymentMethodId: z.string().min(1),
  action: z.enum(['set_default'])
})

export const PATCH = withValidation(
  updatePaymentMethodSchema,
  async (request) => {
    try {
      const { userId } = await auth()

      if (!userId) {
        return NextResponse.json(
          { errorCode: 'UNAUTHORIZED', message: 'You must be signed in' },
          { status: 401 }
        )
      }

      const { paymentMethodId, action } = request.validatedBody as z.infer<typeof updatePaymentMethodSchema>

      // Get or create customer
      const customer = await getOrCreateCustomer(userId)

      if (action === 'set_default') {
        await setDefaultPaymentMethod(customer.id, paymentMethodId)
      }

      return NextResponse.json({
        success: true,
        message: 'Payment method updated'
      })

    } catch (error: any) {
      console.error('Error updating payment method:', error)
      return NextResponse.json(
        { errorCode: 'UPDATE_ERROR', message: error.message },
        { status: 500 }
      )
    }
  }
)

// ===== DELETE - Remove Payment Method =====

const deletePaymentMethodSchema = z.object({
  paymentMethodId: z.string().min(1)
})

export const DELETE = withValidation(
  deletePaymentMethodSchema,
  async (request) => {
    try {
      const { userId } = await auth()

      if (!userId) {
        return NextResponse.json(
          { errorCode: 'UNAUTHORIZED', message: 'You must be signed in' },
          { status: 401 }
        )
      }

      const { paymentMethodId } = request.validatedBody as z.infer<typeof deletePaymentMethodSchema>

      // Detach payment method
      await detachPaymentMethod(paymentMethodId)

      return NextResponse.json({
        success: true,
        message: 'Payment method deleted'
      })

    } catch (error: any) {
      console.error('Error deleting payment method:', error)
      return NextResponse.json(
        { errorCode: 'DELETE_ERROR', message: error.message },
        { status: 500 }
      )
    }
  }
)
