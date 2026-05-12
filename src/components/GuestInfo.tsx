import React, { useState, useRef, useEffect } from 'react';
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
};

const OTP_LENGTH = 4;

const GuestInfo: React.FC<Props> = ({ formData, onUpdate, phoneVerified, onPhoneVerified, smsOptIn, onSmsOptIn, otpEnabled }) => {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [otpSent, setOtpSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
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

  // Auto-verify when all digits are filled
  useEffect(() => {
    if (code.length === OTP_LENGTH && otpSent && !isVerifying) {
      handleVerifyCode(code);
    }
  }, [code]);

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
    setDigits(Array(OTP_LENGTH).fill(''));
    setOtpError(null);
  };

  const handleSendCode = async () => {
    setIsSending(true);
    setOtpError(null);
    setDigits(Array(OTP_LENGTH).fill(''));
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formData.phone }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setOtpSent(true);
    } catch {
      setOtpError('Couldn\'t send a code. Check the number and try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyCode = async (codeToVerify: string) => {
    setIsVerifying(true);
    setOtpError(null);
    try {
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formData.phone, code: codeToVerify }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      if (data.valid) {
        onPhoneVerified(true);
      } else {
        setOtpError('Incorrect code — please try again.');
        setDigits(Array(OTP_LENGTH).fill(''));
        setShake(true);
        setTimeout(() => {
          setShake(false);
          inputRefs.current[0]?.focus();
        }, 500);
      }
    } catch {
      setOtpError('Verification failed. Please try again.');
      setDigits(Array(OTP_LENGTH).fill(''));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setOtpError(null);
    if (digit && index < OTP_LENGTH - 1) {
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
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4" />
              <span>Full Name</span>
            </div>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="John Doe"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <div className="flex items-center space-x-2">
              <Mail className="w-4 h-4" />
              <span>Email</span>
            </div>
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => onUpdate({ email: e.target.value })}
            placeholder="john@example.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={smsOptIn}
              onChange={(e) => onSmsOptIn(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span className="text-xs text-gray-500 leading-relaxed">
              I agree to receive SMS messages from Thaiphoon Restaurant for reservation verification and reminders. Message frequency varies. Message &amp; data rates may apply. Reply <strong className="font-semibold text-gray-600">STOP</strong> to cancel, <strong className="font-semibold text-gray-600">HELP</strong> for help.
            </span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
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
              value={formData.phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="(123)-456-7890"
              className="w-full px-3 py-2 border-0 focus:outline-none"
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
                    ? `Enter the 4-digit code sent to ${formData.phone}`
                    : `We'll send a 4-digit code to ${formData.phone} to confirm this number.`}
                </p>
              </div>

              {/* 4-digit boxes — always shown, disabled until code is sent */}
              <div
                className={`flex gap-2 ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}
                style={shake ? { animation: 'shake 0.4s ease-in-out' } : {}}
              >
                {digits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    disabled={!otpSent || isVerifying}
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
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <span>✕</span> {otpError}
                </p>
              )}

              {/* Send / Resend button */}
              <button
                type="button"
                onClick={handleSendCode}
                disabled={isSending || !smsOptIn}
                title={!smsOptIn ? 'Please agree to SMS terms on the previous step' : undefined}
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
