"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CarTiles } from "@/components/ui/cartiles"
import { GreetingClock } from "./ui/greetingclock"

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
    time: null as string | null,
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
      time: null,
      firstName: "",
      lastName: "",
      email: "",
      telephone: ""
    })
  }

  const updateFormData = (newData: Partial<typeof formData>) => {
    setFormData(prevData => {
      // If the date changes, reset the time
      if (newData.date && newData.date !== prevData.date) {
        return { ...prevData, ...newData, time: null }
      }
      return { ...prevData, ...newData }
    })
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar businessName="Thaiphoon Restaurant" />
      <div className="container mx-auto p-4 pt-8">
        <Card className="w-full max-w-md mx-auto">
          <CardContent className="w-full">
            <form onSubmit={handleSubmit}>
              {step === 1 && (
                <div className="grid gap-4 py-4">
                  <DatePicker
                    selectedDate={formData.date}
                    onSelect={(date) => updateFormData({ date })}
                  />
                  {formData.date && (
                    <TimePicker
                      selectedDate={formData.date}
                      selectedTime={formData.time || ""}
                      onSelect={(time) => updateFormData({ time })}
                    />
                  )}
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
        {/* Add the CarCarousel component here */}
        <div className="mt-2">
          <CarTiles />
        </div>
        <GreetingClock />
      </div>
    </div>
  )
}

function DatePicker({ selectedDate, onSelect }: { selectedDate: Date | null, onSelect: (date: Date | null) => void }) {
  return (
    <div className="grid gap-2 w-full">
      <Label htmlFor="date">Date</Label>
      <div className="w-full">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={onSelect}
          className="w-full border rounded-md"
          classNames={{
            months: "w-full",
            month: "w-full",
            table: "w-full border-collapse",
            head_row: "flex",
            head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] flex-1",
            row: "flex w-full",
            cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20 flex-1",
            day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-muted flex items-center justify-center flex-1",
            day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            day_today: "bg-accent text-accent-foreground",
            day_outside: "text-muted-foreground opacity-50",
            day_disabled: "text-muted-foreground opacity-50",
            day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
            day_hidden: "invisible",
            nav: "space-x-1 flex items-center",
            nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
            nav_button_previous: "absolute left-1",
            nav_button_next: "absolute right-1",
            caption: "flex justify-center pt-1 relative items-center",
            caption_label: "text-sm font-medium",
          }}
          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
        />
      </div>
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

          // Convert slot time to minutes since midnight for easier comparison
          const slotTimeInMinutes = slotHour * 60 + minutes
          const cutoffTimeInMinutes = cutoffHour * 60 + cutoffMinute

          return slotTimeInMinutes > cutoffTimeInMinutes
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
      <Select value={selectedTime} onValueChange={onSelect}>
        <SelectTrigger id="time">
          <SelectValue placeholder="Select a time" />
        </SelectTrigger>
        <SelectContent>
          {availableTimeSlots.length > 0 ? (
            availableTimeSlots.map((slot) => (
              <SelectItem key={slot} value={slot}>
                {slot}
              </SelectItem>
            ))
          ) : (
            <SelectItem value="" disabled>No available times</SelectItem>
          )}
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
  const displayTime = formData.time.split(' ').slice(0, 2).join(' ');

  return (
    <div className="grid gap-4 py-4">
      <h3 className="text-lg font-semibold">Confirm your reservation</h3>
      <p>Date: {formData.date?.toDateString()}</p>
      <p>Time: {displayTime}</p>
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