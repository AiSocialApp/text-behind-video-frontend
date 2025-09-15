import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/useAuth"
import React from "react";
import { AuthApi } from "@/lib/api";


const Authenticate = () => {
  const { login, register } = useAuth()
  const { toast } = useToast()
  const [mode, setMode] = React.useState<'login' | 'signup' | 'forgot' | 'confirm' | 'reset'>("login")
  const [loading, setLoading] = React.useState(false)
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [givenName, setGivenName] = React.useState("")
  const [familyName, setFamilyName] = React.useState("")
  const [confirmationCode, setConfirmationCode] = React.useState("")
  const [resetCode, setResetCode] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(pwd)) return "Password must include an uppercase letter";
    if (!/[a-z]/.test(pwd)) return "Password must include a lowercase letter";
    if (!/[0-9]/.test(pwd)) return "Password must include a digit";
    if (!/[!@#$%^&*(),.?\":{}|<>_\-\[\]\\/+=~`']/.test(pwd)) return "Password must include a special character";
    return null;
  }
  
  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      if (mode === 'login') {
        await login(email, password)
      } else if (mode === 'signup') {
        if (password !== confirmPassword) {
          toast({ title: 'Passwords do not match', description: 'Re-enter matching passwords.' })
          return;
        }
        const pwdError = validatePassword(password)
        if (pwdError) {
          toast({ title: 'Invalid password', description: pwdError })
          return;
        }
        await register({ email, password, given_name: givenName, family_name: familyName })
        toast({ title: 'Account created', description: 'Check your email for a confirmation code.' })
        setMode('confirm')
      } else if (mode === 'confirm') {
        await AuthApi.confirmEmail(email, confirmationCode)
        toast({ title: 'Email confirmed', description: 'You can now sign in.' })
        setMode('login')
      } else if (mode === 'forgot') {
        await AuthApi.forgotPassword(email)
        toast({ title: 'Reset code sent', description: 'Check your email for the reset code.' })
        setMode('reset')
      } else if (mode === 'reset') {
        await AuthApi.resetPassword(email, resetCode, newPassword)
        toast({ title: 'Password reset', description: 'You can now sign in with your new password.' })
        setMode('login')
      }
    } catch (err: any) {
      const code = String(err?.detail || err?.message || '').trim()
      if (mode === 'login') {
        if (code === 'user_not_confirmed') {
          setMode('confirm')
          toast({ title: 'Confirm Email', description: 'Please enter the code sent to your email.' })
        } else if (code === 'invalid_credentials') {
          toast({ title: 'Incorrect email or password', description: 'Please check your details and try again.' })
        } else {
          toast({ title: 'Login failed', description: code || 'Try again' })
        }
      } else if (mode === 'signup') {
        if (code === 'email_exists') {
          toast({ title: 'An account with this email already exists.', description: 'Try signing in or resetting your password.' })
        } else if (code === 'invalid_password') {
          toast({ title: 'Password does not meet requirements', description: 'Use at least 8 chars, upper, lower, digit, special.' })
        } else {
          toast({ title: 'Sign up failed', description: code || 'Try again' })
        }
      } else if (mode === 'confirm') {
        if (code === 'invalid_code') {
          toast({ title: 'Invalid confirmation code', description: 'Please check the code and try again.' })
        } else {
          toast({ title: 'Confirmation failed', description: code || 'Try again' })
        }
      } else if (mode === 'forgot') {
        toast({ title: 'Request failed', description: code || 'Try again' })
      } else if (mode === 'reset') {
        if (code === 'invalid_code') {
          toast({ title: 'Invalid reset code', description: 'Please check the code and try again.' })
        } else if (code === 'invalid_password') {
          toast({ title: 'Password does not meet requirements', description: 'Use at least 8 chars, upper, lower, digit, special.' })
        } else {
          toast({ title: 'Reset failed', description: code || 'Try again' })
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog defaultOpen>
      <AlertDialogTrigger asChild>
        <></>
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'confirm' ? 'Confirm Email' : mode === 'forgot' ? 'Forgot Password' : 'Reset Password'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {mode === 'login' && 'Use your email and password to continue.'}
            {mode === 'signup' && 'Create an account to get started.'}
            {mode === 'confirm' && 'Enter the confirmation code sent to your email.'}
            {mode === 'forgot' && 'Enter your email to receive a reset code.'}
            {mode === 'reset' && 'Enter the reset code and choose a new password.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form className="grid gap-4 py-4" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <input name="given_name" value={givenName} onChange={e => setGivenName(e.target.value)} type="text" placeholder="First name" className="border rounded px-3 py-2" required disabled={loading} />
              <input name="family_name" value={familyName} onChange={e => setFamilyName(e.target.value)} type="text" placeholder="Last name" className="border rounded px-3 py-2" required disabled={loading} />
            </>
          )}
          {mode === 'confirm' && (
            <>
              <div className="text-sm text-muted-foreground">Confirming email for <span className="font-medium">{email}</span></div>
              <input name="confirmation_code" value={confirmationCode} onChange={e => setConfirmationCode(e.target.value)} type="text" placeholder="Confirmation code" className="border rounded px-3 py-2" required disabled={loading} />
              <button type="button" className="text-sm text-primary underline justify-self-start" disabled={loading || !email} onClick={async () => { try { setLoading(true); await AuthApi.resendCode(email); toast({ title: 'Code resent' }); } catch (err: any) { toast({ title: 'Resend failed', description: err?.message || 'Try again' }); } finally { setLoading(false); } }}>Resend code</button>
            </>
          )}
          {(mode === 'login' || mode === 'signup') && (
            <>
              <input name="email" value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email" className="border rounded px-3 py-2" required disabled={loading} />
              <input name="password" value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password" className="border rounded px-3 py-2" required disabled={loading} />
              {mode === 'signup' && (
                <input name="confirm_password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} type="password" placeholder="Confirm password" className="border rounded px-3 py-2" required disabled={loading} />
              )}
            </>
          )}
          {mode === 'forgot' && (
            <>
              <input name="email" value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email" className="border rounded px-3 py-2" required disabled={loading} />
            </>
          )}
          {mode === 'reset' && (
            <>
              <div className="text-sm text-muted-foreground">Resetting password for <span className="font-medium">{email}</span></div>
              <input name="reset_code" value={resetCode} onChange={e => setResetCode(e.target.value)} type="text" placeholder="Reset code" className="border rounded px-3 py-2" required disabled={loading} />
              <input name="new_password" value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password" placeholder="New password" className="border rounded px-3 py-2" required disabled={loading} />
            </>
          )}
          {mode === 'login' && (
            <button type="button" className="text-sm text-primary underline justify-self-start" disabled={loading} onClick={() => setMode('forgot')}>
              Forgot password?
            </button>
          )}
          <Button type="submit" variant="default" className="w-full" disabled={loading}>
            {loading ? 'Please wait…' : (mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Sign up' : mode === 'forgot' ? 'Send reset code' : 'Confirm email')}
          </Button>
          <button type="button" className="text-sm text-primary underline" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} disabled={loading}>
            {mode === 'login' ? 'Create an account' : 'Have an account? Sign in'}
          </button>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default Authenticate
