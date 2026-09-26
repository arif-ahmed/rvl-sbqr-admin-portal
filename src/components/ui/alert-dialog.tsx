import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '../../lib/utils'
import { Button } from './button'

export const AlertDialog = AlertDialogPrimitive.Root
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger
export const AlertDialogCancel = AlertDialogPrimitive.Cancel

export function AlertDialogContent({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="fixed inset-0 z-40 bg-bqr-ink/40" />
      <AlertDialogPrimitive.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2',
          'rounded-lg border border-bqr-border bg-white p-6 shadow-lg',
          'focus:outline-none',
          className,
        )}
        {...props}
      >
        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  )
}

export function AlertDialogTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      className={cn('text-base font-semibold text-bqr-ink', className)}
      {...props}
    />
  )
}

export function AlertDialogDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      className={cn('mt-2 text-sm text-bqr-ink-soft', className)}
      {...props}
    />
  )
}

export function AlertDialogFooter({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('mt-6 flex justify-end gap-2', className)} {...props} />
}

export function AlertDialogAction({
  className,
  variant = 'primary',
  loading,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action> & {
  variant?: 'primary' | 'danger'
  loading?: boolean
}) {
  return (
    <AlertDialogPrimitive.Action asChild>
      <Button variant={variant} loading={loading} className={className} {...props}>
        {children}
      </Button>
    </AlertDialogPrimitive.Action>
  )
}

export function AlertDialogCancel_Button({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel asChild>
      <Button variant="outline" {...props} className={className} />
    </AlertDialogPrimitive.Cancel>
  )
}
