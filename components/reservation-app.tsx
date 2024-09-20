"use client"

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AccountCircle } from '@mui/icons-material';

import { Card, CardContent } from "@/components/ui/card";
import { CarTiles } from "@/components/ui/cartiles";
import { GreetingClock } from "./ui/greetingclock";
import { cn } from "@/lib/utils";
import DotPattern from "@/components/magicui/dot-pattern";
import { BorderBeam } from "@/components/magicui/border-beam";
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { Select, SelectChangeEvent, MenuItem, FormControl, InputLabel, Input, InputAdornment } from '@mui/material';
import { saveReservation } from '../firebase'
import { DateCalendar } from "@mui/x-date-pickers";
import Marquee from "@/components/magicui/marquee";

interface FormData {
  date: Date | null;
  time: string | null;
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
}

const CateringImage = ({ src }: { src: string }) => {
  return (
    <Card className="w-96 h-40 mx-0 overflow-hidden">
      <img
        src={src}
        alt="Catering"
        className="w-full h-full object-cover"
      />
    </Card>
  );
};

export function ReservationAppComponent() {
  const [formData, setFormData] = useState<FormData>({
    date: null,
    time: null,
    firstName: "",
    lastName: "",
    email: "",
    telephone: ""
  });
  const [openConfirm, setOpenConfirm] = useState(false);

  const cateringImages = [
    './images/catering.jpg',
    './images/sticky-rice-mango.JPG',
    './images/fresh-rolls.jpg',
    // Add more image paths as needed
  ];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setOpenConfirm(true);
  };

  const confirmReservation = async () => {
    setOpenConfirm(false);
    try {
      const reservationData = {
        ...formData,
        date: formData.date ? formData.date.toISOString() : '',
        time: formData.time || '',
      };
      const reservationId = await saveReservation(reservationData);
      console.log("Reservation saved with ID:", reservationId);
      // Reset form or show success message
    } catch (error) {
      console.error("Error saving reservation:", error);
    }
  };

  const updateFormData = (newData: Partial<FormData>) => {
    console.log(formData);
    setFormData(prevData => ({
      ...prevData,
      ...newData,
    }));
  };

  const resetForm = () => {
    setFormData({
      date: null,
      time: null,
      firstName: "",
      lastName: "",
      email: "",
      telephone: ""
    });
  };

  return (
    <>
      <div className="min-h-screen bg-gray-100 relative overflow-hidden">
        <DotPattern
          width={15}
          height={15}
          cx={1}
          cy={1}
          cr={1}
          className={cn(
            "absolute inset-0 z-0",
            "opacity-100",

          )}
        />
        <Navbar businessName="Thaiphoon Restaurant" />
        <div className="container mx-auto m-8 relative z-10">
          <div className="w-full max-w-7xl bg-transparent mx-auto sm:p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 relative">
              <div className="md:col-span-1 md:h-auto">
                <GreetingClock />
              </div>
              <Card className="md:col-span-2 md:h-auto overflow-hidden bg-transparent shadow-none border-none">
                <Marquee pauseOnHover className="[--duration:20s]">
                  {cateringImages.map((src, index) => (
                    <CateringImage key={`catering-${index}`} src={src} />
                  ))}
                </Marquee>
              </Card>
            </div>
            <Card className="w-full max-w-7xl mx-auto shadow-md">
              <CardContent className="p-6 shadow-lg">
                <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row justify-between items-start gap-8">
                  <div className="w-full lg:w-auto flex-shrink-0">
                    <LocalizationProvider dateAdapter={AdapterDayjs}>

                      <DateCalendar

                        value={formData.date ? dayjs(formData.date) : null}
                        onChange={(newValue) => updateFormData({ date: newValue ? newValue.toDate() : null })}
                        disablePast
                      />
                    </LocalizationProvider>
                    <TimePicker
                      selectedDate={formData.date}
                      selectedTime={formData.time || ""}
                      onSelect={(time) => updateFormData({ time })}
                      disabled={!formData.date}
                    />
                  </div>
                  <div className="w-full my-auto mx-auto mt-3 lg:w-1/2 grid gap-4">

                    <Input
                      className="mb-7"
                      id="input-with-icon-adornment"
                      startAdornment={
                        <InputAdornment position="start">
                          <AccountCircle />
                        </InputAdornment>
                      }
                      placeholder="First Name"
                      value={formData.firstName}
                      onChange={(e) => updateFormData({ firstName: e.target.value })}
                    />
                    <Input
                      className="mb-7"
                      id="input-with-icon-adornment"
                      startAdornment={
                        <InputAdornment position="start">
                          <AccountCircle />
                        </InputAdornment>
                      }
                      placeholder="Last Name"
                      value={formData.lastName}
                      onChange={(e) => updateFormData({ lastName: e.target.value })}
                    />
                    <Input
                      className="mb-7"
                      id="input-with-icon-adornment"
                      startAdornment={
                        <InputAdornment position="start">
                          <AccountCircle />
                        </InputAdornment>
                      }
                      type="email"
                      placeholder="Email"
                      value={formData.email}
                      onChange={(e) => updateFormData({ email: e.target.value })}
                    />
                    <Input
                      className="mb-7"
                      id="input-with-icon-adornment"
                      startAdornment={
                        <InputAdornment position="start">
                          <AccountCircle />
                        </InputAdornment>
                      }
                      type="tel"
                      placeholder="Telephone"
                      value={formData.telephone}
                      onChange={(e) => updateFormData({ telephone: e.target.value })}
                    />
                    <div className="flex gap-2 mt-5">
                      <Button
                        type="submit"
                        className="flex-grow"
                        disabled={!formData.date || !formData.time || !formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim() || !formData.telephone.trim()}
                      >
                        Confirm Reservation
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetForm}
                        className="flex-shrink-0"
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
            <div className="mt-10 mx-0">
              <CarTiles />
            </div>
          </div>
        </div>
        <div className={`fixed inset-0 z-50 overflow-y-auto ${openConfirm ? 'flex' : 'hidden'} items-center justify-center`}>
          <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={() => setOpenConfirm(false)}></div>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 z-50 transform transition-all">
            <div className="bg-blue-600 text-white px-6 py-4 rounded-t-lg flex justify-between items-center">
              <h3 className="text-xl font-semibold">Confirm Reservation</h3>
              <button onClick={() => setOpenConfirm(false)} className="text-white hover:text-gray-200 text-2xl leading-none">&times;</button>
            </div>
            <div className="px-6 py-4">
              <h4 className="font-medium text-lg mb-4 text-gray-700">Please confirm your reservation details:</h4>
              <div className="space-y-2 text-gray-600">
                <p><span className="font-semibold">Date:</span> {formData.date?.toLocaleDateString()}</p>
                <p><span className="font-semibold">Time:</span> {formData.time}</p>
                <p><span className="font-semibold">Name:</span> {formData.firstName} {formData.lastName}</p>
                <p><span className="font-semibold">Email:</span> {formData.email}</p>
                <p><span className="font-semibold">Telephone:</span> {formData.telephone}</p>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end space-x-2">
              <button
                onClick={() => setOpenConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded transition duration-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmReservation}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded transition duration-200"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Navbar({ businessName }: { businessName: string }) {
  return (
    <nav className="bg-white shadow-sm z-50 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0">
            <h1 className="text-xl font-bold">{businessName}</h1>
          </div>
        </div>
      </div>
    </nav>
  );
}

function FeatureTile({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <Card>
      <CardContent>
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold">{title}</h3>
        </div>
        <p className="mt-2">{description}</p>
      </CardContent>
    </Card>
  );
}

function TimePicker({ selectedDate, selectedTime, onSelect, disabled }: {
  selectedDate: Date | null,
  selectedTime: string | null,
  onSelect: (time: string) => void,
  disabled: boolean
}) {
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [localSelectedTime, setLocalSelectedTime] = useState<string>("");

  useEffect(() => {
    setLocalSelectedTime(selectedTime || "");
  }, [selectedTime]);

  useEffect(() => {
    if (selectedDate) {
      const timeSlots = generateTimeSlots();
      const now = new Date();
      const isToday = selectedDate.toDateString() === now.toDateString();

      if (isToday) {
        const oneAndHalfHoursLater = new Date(now.getTime() + 1.5 * 60 * 60 * 1000);
        const cutoffHour = oneAndHalfHoursLater.getHours();
        const cutoffMinute = oneAndHalfHoursLater.getMinutes();

        const updatedSlots = timeSlots.filter(slot => {
          const [time, period] = slot.split(' ');
          const [hours, minutes] = time.split(':').map(Number);
          const slotHour = hours % 12 + (period === 'PM' && hours !== 12 ? 12 : 0);
          const slotTimeInMinutes = slotHour * 60 + minutes;
          const cutoffTimeInMinutes = cutoffHour * 60 + cutoffMinute;
          return slotTimeInMinutes > cutoffTimeInMinutes;
        });
        setAvailableTimeSlots(updatedSlots);
      } else {
        setAvailableTimeSlots(timeSlots);
      }
    } else {
      setAvailableTimeSlots([]);
    }
  }, [selectedDate]);

  const handleChange = (event: SelectChangeEvent<string>) => {
    const newTime = event.target.value;
    setLocalSelectedTime(newTime);
    onSelect(newTime);
    console.log("Selected time in TimePicker:", newTime);
  };

  return (
    <FormControl fullWidth size="small" disabled={disabled}>
      <InputLabel id="time-select-label">Time</InputLabel>
      <Select
        labelId="time-select-label"
        id="time-select"
        value={localSelectedTime}
        label="Time"
        onChange={handleChange}
        size="small"
        disabled={disabled}
        MenuProps={{
          PaperProps: {
            style: {
              maxHeight: 224,
            },
          },
        }}
      >
        <MenuItem value="" disabled>Select a time</MenuItem>
        {availableTimeSlots.map((slot) => (
          <MenuItem key={slot} value={slot}>
            {slot}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function generateTimeSlots() {
  const slots = [];
  const addSlots = (start: number, end: number) => {
    for (let hour = start; hour < end; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        const time = `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
        slots.push(time);
      }
    }
  };

  addSlots(11, 14); // 11:00 AM to 2:00 PM
  addSlots(16, 20); // 4:00 PM to 8:00 PM
  slots.push('8:30 PM'); // Add 8:30 PM

  return slots;
}
