"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function Navbar({ businessName }: { businessName: string }) {
  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0">
            <h1 className="text-xl font-bold">{businessName}</h1>
          </div>
        </div>
      </div>
    </nav>
  )
}

export function ReservationAppComponent() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    date: null as Date | null,
    time: "",
    firstName: "",
    lastName: "",
    email: "",
    telephone: ""
  })

  const handleNext = () => {
    setStep(step + 1)
  }

  const handlePrevious = () => {
    setStep(step - 1)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Here you would typically send the data to your backend
    console.log("'Submitting reservation:'", formData)
    // Reset form after submission
    setStep(1)
    setFormData({
      date: null,
      time: "",
      firstName: "",
      lastName: "",
      email: "",
      telephone: ""
    })
  }

  const updateFormData = (newData: Partial<typeof formData>) => {
    setFormData({ ...formData, ...newData })
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar businessName="Thaiphoon Restaurant" />
      <div className="container mx-auto p-4 pt-8">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Make a Reservation</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              {step === 1 && (
                <div className="grid gap-4 py-4">
                  <DatePicker
                    selectedDate={formData.date}
                    onSelect={(date) => updateFormData({ date })}
                  />
                  <TimePicker
                    selectedDate={formData.date}
                    selectedTime={formData.time}
                    onSelect={(time) => updateFormData({ time })}
                  />
                  <Button type="button" onClick={handleNext} disabled={!formData.date || !formData.time}>
                    Next
                  </Button>
                </div>
              )}
              {step === 2 && (
                <PersonalInfo
                  formData={formData}
                  updateFormData={updateFormData}
                  onNext={handleNext}
                  onPrevious={handlePrevious}
                />
              )}
              {step === 3 && (
                <Confirmation
                  formData={formData}
                  onPrevious={handlePrevious}
                  onSubmit={handleSubmit}
                />
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function DatePicker({ selectedDate, onSelect }: { selectedDate: Date | null, onSelect: (date: Date | null) => void }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="date">Date</Label>
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={onSelect}
        className="rounded-md border"
        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
        classNames={{
          day_selected: "border-2 border-black bg-white text-black hover:bg-white hover:text-black focus:bg-white focus:text-black",
        }}
      />
    </div>
  )
}

function TimePicker({ selectedDate, selectedTime, onSelect }: {
  selectedDate: Date | null,
  selectedTime: string,
  onSelect: (time: string) => void
}) {
  const timeSlots = generateTimeSlots()
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([])

  useEffect(() => {
    if (selectedDate) {
      const now = new Date()
      const isToday = selectedDate.toDateString() === now.toDateString()

      if (isToday) {
        // Add 1.5 hours to the current time
        const oneAndHalfHoursLater = new Date(now.getTime() + 1.5 * 60 * 60 * 1000)
        const cutoffHour = oneAndHalfHoursLater.getHours()
        const cutoffMinute = oneAndHalfHoursLater.getMinutes()

        const updatedSlots = timeSlots.filter(slot => {
          const [time, period] = slot.split(' ')
          const [hours, minutes] = time.split(':').map(Number)
          const slotHour = hours % 12 + (period === 'PM' && hours !== 12 ? 12 : 0)

          if (slotHour > cutoffHour) return true
          if (slotHour === cutoffHour && minutes > cutoffMinute) return true
          return false
        })
        setAvailableTimeSlots(updatedSlots)
      } else {
        setAvailableTimeSlots(timeSlots)
      }
    } else {
      setAvailableTimeSlots([])
    }
  }, [selectedDate])

  return (
    <div className="grid gap-2">
      <Label htmlFor="time">Time</Label>
      <Select value={selectedTime} onValueChange={onSelect} disabled={!selectedDate}>
        <SelectTrigger id="time">
          <SelectValue placeholder={selectedDate ? "Select a time" : "Please select a date first"} />
        </SelectTrigger>
        <SelectContent>
          {availableTimeSlots.map((slot) => (
            <SelectItem key={slot} value={slot}>
              {slot}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function generateTimeSlots() {
  const slots = []
  const addSlots = (start: number, end: number) => {
    for (let hour = start; hour < end; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const period = hour >= 12 ? 'PM' : 'AM'
        const displayHour = hour % 12 || 12
        const time = `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`
        slots.push(time)
      }
    }
  }

  addSlots(11, 14) // 11:00 AM to 2:00 PM
  addSlots(16, 20) // 4:00 PM to 8:00 PM
  slots.push('8:30 PM') // Add 8:30 PM

  return slots
}

function PersonalInfo({ formData, updateFormData, onNext, onPrevious }: {
  formData: typeof ReservationAppComponent.prototype.state.formData,
  updateFormData: (data: Partial<typeof ReservationAppComponent.prototype.state.formData>) => void,
  onNext: () => void,
  onPrevious: () => void
}) {
  return (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="firstName">First Name</Label>
        <Input
          id="firstName"
          value={formData.firstName}
          onChange={(e) => updateFormData({ firstName: e.target.value })}
          placeholder="Johnny"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="lastName">Last Name</Label>
        <Input
          id="lastName"
          value={formData.lastName}
          onChange={(e) => updateFormData({ lastName: e.target.value })}
          placeholder="Appleseed"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => updateFormData({ email: e.target.value })}
          placeholder="johnny.appleseed@example.com"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="telephone">Telephone</Label>
        <Input
          id="telephone"
          type="tel"
          value={formData.telephone}
          onChange={(e) => updateFormData({ telephone: e.target.value })}
          placeholder="(123) 456-7890"
        />
      </div>
      <div className="flex justify-between">
        <Button type="button" onClick={onPrevious}>Previous</Button>
        <Button
          type="button"
          onClick={onNext}
          disabled={!formData.firstName || !formData.lastName || !formData.email || !formData.telephone}
        >
          Next
        </Button>
      </div>
    </div>
  )
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const period = Number(hours) >= 12 ? 'PM' : 'AM';
  const formattedHours = Number(hours) % 12 || 12;
  return `${formattedHours}:${minutes} ${period}`;
}

function Confirmation({ formData, onPrevious, onSubmit }: {
  formData: typeof ReservationAppComponent.prototype.state.formData,
  onPrevious: () => void,
  onSubmit: (e: React.FormEvent) => void
}) {
  return (
    <div className="grid gap-4 py-4">
      <h3 className="text-lg font-semibold">Confirm your reservation</h3>
      <p>Date: {formData.date?.toDateString()}</p>
      <p>Time: {formData.time ? formatTime(formData.time) : ''}</p>
      <p>Name: {formData.firstName} {formData.lastName}</p>
      <p>Email: {formData.email}</p>
      <p>Telephone: {formData.telephone}</p>
      <div className="flex justify-between">
        <Button type="button" onClick={onPrevious}>Previous</Button>
        <Button type="submit" onClick={onSubmit}>Confirm Reservation</Button>
      </div>
    </div>
  )
}