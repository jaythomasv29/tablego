import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User, Mail, Phone, CheckCircle2, Loader2 } from 'lucide-react';
import { ReservationData } from '../App';

type Props = {
  formData: ReservationData;
  onUpdate: (data: Partial<ReservationData>) => void;
  phoneVerified: boolean;
  onPhoneVerified: (verified: boolean) => void;
  smsOptIn: boolean;
  onSmsOptIn: (v: boolean) => void;
  otpEnabled: boolean;
  restaurantName?: string;
  disabled?: boolean;
};

const GuestInfo: React.FC<Props> = ({ formData, onUpdate, phoneVerified, onPhoneVerified, smsOptIn, onSmsOptIn, otpEnabled, restaurantName = 'the restaurant', disabled = false }) => {
  const [otpLength, setOtpLength] = useState(4);
  const [digits, setDigits] = useState<string[]>(Array(otpLength).fill(''));
  const [otpSent, setOtpSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const attemptedVerification = useRef<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const phoneDigits = formData.phone.replace(/\D/g, '');
  const phoneReady = phoneDigits.length === 10;
  const code = digits.join('');

  // Focus first digit box when code is sent
  useEffect(() => {
    if (otpSent) {
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    }
  }, [otpSent]);

  const formatPhoneNumber = (input: string): string => {
    const d = input.replace(/\D/g, '').slice(0, 10);
    if (d.length === 0) return '';
    if (d.length < 4) return `(${d}`;
    if (d.length < 7) return `(${d.slice(0, 3)})-${d.slice(3)}`;
    return `(${d.slice(0, 3)})-${d.slice(3, 6)}-${d.slice(6)}`;
  };

  const handlePhoneChange = (value: string) => {
    onUpdate({ phone: formatPhoneNumber(value) });
    onPhoneVerified(false);
    setOtpSent(false);
    setDigits(Array(otpLength).fill(''));
    setOtpError(null);
  };

  const handleSendCode = async () => {
    setIsSending(true);
    setOtpError(null);
    setDigits(Array(otpLength).fill(''));
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formData.phone }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      const length = data.codeLength === undefined ? 4 : data.codeLength;
      if (!Number.isInteger(length) || length < 4 || length > 10) throw new Error('Invalid code length');
      setOtpLength(length); setDigits(Array(length).fill(''));
      setOtpSent(true);
    } catch {
      setOtpError('Couldn\'t send a code. Check the number and try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyCode = useCallback(async (codeToVerify: string) => {
    setIsVerifying(true);
    setOtpError(null);
    try {
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formData.phone, code: codeToVerify }),
      });
      const data = await res.json();
      if (!data.success) {
        setOtpError(data.error || 'Verification failed. Please try again.');
        setDigits(Array(otpLength).fill(''));
        return;
      }
      if (data.valid) {
        onPhoneVerified(true);
      } else {
        setOtpError('Incorrect code — please try again.');
        setDigits(Array(otpLength).fill(''));
        setShake(true);
        setTimeout(() => {
          setShake(false);
          inputRefs.current[0]?.focus();
        }, 500);
      }
    } catch {
      setOtpError('Verification failed. Please try again.');
      setDigits(Array(otpLength).fill(''));
    } finally {
      setIsVerifying(false);
    }
  }, [formData.phone, onPhoneVerified, otpLength]);

  // A completed code is submitted once, even when callbacks change identity.
  useEffect(() => {
    if (code.length !== otpLength || !otpSent) {
      attemptedVerification.current = null;
      return;
    }
    const attempt = `${formData.phone}:${code}`;
    if (isVerifying || phoneVerified || attemptedVerification.current === attempt) return;
    attemptedVerification.current = attempt;
    void handleVerifyCode(code);
  }, [code, otpLength, otpSent, isVerifying, phoneVerified, formData.phone, handleVerifyCode]);


  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setOtpError(null);
    if (digit && index < otpLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits];
        next[index] = '';
        setDigits(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, otpLength);
    if (!pasted) return;
    const next = Array(otpLength).fill('');
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, otpLength - 1)]?.focus();
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6 drop-shadow-sm">
        Guest Information
      </h2>

      <div className="space-y-6">
        <div>

        </div>

        <div>
          <label htmlFor="guest-name" className="block text-sm font-medium text-gray-700 mb-2">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4" />
              <span>Full Name</span>
            </div>
          </label>
          <div className="flex items-center w-full border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
            <input
              type="text"
              id="guest-name" autoComplete="name" maxLength={120} value={formData.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="John Doe"
              disabled={disabled}
              className="w-full px-3 py-2 border-0 bg-white focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        <div>
          <label htmlFor="guest-email" className="block text-sm font-medium text-gray-700 mb-2">
            <div className="flex items-center space-x-2">
              <Mail className="w-4 h-4" />
              <span>Email</span>
            </div>
          </label>
          <div className="flex items-center w-full border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
            <input
              type="email"
              id="guest-email" autoComplete="email" maxLength={254} value={formData.email}
              onChange={(e) => onUpdate({ email: e.target.value })}
              placeholder="john@example.com"
              disabled={disabled}
              className="w-full px-3 py-2 border-0 bg-white focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        <div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={smsOptIn}
              onChange={(e) => onSmsOptIn(e.target.checked)}
              disabled={disabled}
              className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ accentColor: '#A3B18A', colorScheme: 'light' }}
            />
            <span className="text-xs text-gray-500 leading-relaxed">
              Send me optional SMS reservation reminders from {restaurantName}. Message frequency varies. Message &amp; data rates may apply. Reply <strong className="font-semibold text-gray-600">STOP</strong> to cancel, <strong className="font-semibold text-gray-600">HELP</strong> for help.
            </span>
          </label>
        </div>

        <div>
          <label htmlFor="guest-phone" className="block text-sm font-medium text-gray-700 mb-2">
            <div className="flex items-center space-x-2">
              <Phone className="w-4 h-4" />
              <span>Phone Number</span>
            </div>
          </label>

          <div className={`flex items-center w-full border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 ${phoneVerified ? 'border-green-400' : 'border-gray-300'}`}>
            <span className="px-3 py-2 bg-gray-50 border-r border-gray-300 text-gray-700 text-sm font-medium">
              +1
            </span>
            <input
              type="tel"
              id="guest-phone" autoComplete="tel-national" maxLength={40} value={formData.phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="(123)-456-7890"
              disabled={disabled || isSending || isVerifying}
              className="w-full px-3 py-2 border-0 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {otpEnabled && phoneVerified && (
              <CheckCircle2 className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
            )}
          </div>

          {/* Verification panel — only shown when OTP is enabled */}
          {otpEnabled && phoneReady && !phoneVerified && (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-800">Verify your phone number</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {otpSent
                    ? `Enter the ${otpLength}-digit code sent to ${formData.phone}`
                    : `We’ll text a verification code to ${formData.phone} to confirm this number. Message and data rates may apply.`}
                </p>
              </div>

              {/* Code length is supplied by the verification provider. */}
              <div
                className={`flex flex-wrap gap-2 ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}
                style={shake ? { animation: 'shake 0.4s ease-in-out' } : {}}
              >
                {digits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    aria-label={`Verification digit ${i + 1}`}
                    maxLength={1}
                    value={digit}
                    disabled={!otpSent || isSending || isVerifying || disabled}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(i, e)}
                    onPaste={i === 0 ? handleDigitPaste : undefined}
                    className={`w-12 h-12 text-center text-xl font-bold border rounded-lg transition-all focus:outline-none
                      ${!otpSent
                        ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                        : otpError
                        ? 'border-red-400 bg-red-50 text-red-700 focus:ring-2 focus:ring-red-400'
                        : 'border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                      }`}
                  />
                ))}

                {isVerifying && (
                  <div className="flex items-center ml-1">
                    <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                  </div>
                )}
              </div>

              {otpError && (
                <p role="alert" className="text-xs text-red-600 flex items-center gap-1">
                  <span>✕</span> {otpError}
                </p>
              )}

              {/* Send / Resend button */}
              <button
                type="button"
                onClick={handleSendCode}
                disabled={isSending || isVerifying || disabled}
                className="text-xs text-indigo-600 hover:text-indigo-800 underline underline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {isSending && <Loader2 className="w-3 h-3 animate-spin" />}
                {isSending ? 'Sending…' : otpSent ? 'Resend code' : 'Send code'}
              </button>
            </div>
          )}

          {phoneVerified && (
            <div className="mt-2 flex items-center gap-1.5 text-green-600 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>Phone verified</span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
};

export default GuestInfo;
