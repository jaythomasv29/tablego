"use client"

import React, { useState, useEffect } from "react";

import { AccountCircle, Book, Mail, Phone } from '@mui/icons-material';

// import { Card, CardContent } from "@/components/ui/card";
import { CarTiles } from "@/components/ui/cartiles";
import { GreetingClock } from "./ui/greetingclock";
import { cn } from "@/lib/utils";
import DotPattern from "@/components/magicui/dot-pattern";

import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { Button, Select, SelectChangeEvent, MenuItem, FormControl, InputLabel, Input, InputAdornment, TextField, Grid2 } from '@mui/material';
import { saveReservation, db } from '../firebase'
import { DateCalendar } from "@mui/x-date-pickers";
import Marquee from "@/components/magicui/marquee";
import Cookies from 'js-cookie';
import { Card, CardContent, Typography, Stack } from '@mui/material';
import { deleteDoc, doc, updateDoc } from 'firebase/firestore';


interface FormData {
  date: Date | null;
  time: string | null;
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
  partySize: number | null;
  status: string; // Add this line
  additionalNotes: string;
}

interface ReservationData {
  reservationId: string;
  date: string;
  time: string;
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
  partySize: number | null;
  status: string; // Add this line
  additionalNotes: string;
}

const CateringImage = ({ src }: { src: string }) => {
  return (
    <Card className="w-100 h-40 mx-1 overflow-hidden">
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
    telephone: "",
    partySize: 0,
    status: "active",
    additionalNotes: "",
  });
  const [openConfirm, setOpenConfirm] = useState(false);
  const [openConfirmationModal, setOpenConfirmationModal] = useState(false);
  const [bookedReservation, setBookedReservation] = useState<ReservationData | null>(null);
  const [isReservationBooked, setIsReservationBooked] = useState(false);

  const cateringImages = [
    './images/catering.jpg',
    './images/sticky-rice-mango.JPG',
    './images/fresh-rolls.jpg',
    // Add more image paths as needed
  ];

  const formatPhoneNumber = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formattedPhone = formatPhoneNumber(formData.telephone);
    setFormData({ ...formData, telephone: formattedPhone });
    setOpenConfirm(true);
  };

  const confirmReservation = async () => {
    setOpenConfirm(false);
    try {
      const reservationData = {
        ...formData,
        date: formData.date ? formData.date.toISOString() : '',
        time: formData.time || '',
        status: "active",
      };
      const reservationId = await saveReservation(reservationData);
      const fullReservationData = {
        reservationId,
        ...reservationData
      };
      setBookedReservation(fullReservationData);
      console.log("Reservation saved with ID:", reservationId);
      resetForm();
      setOpenConfirmationModal(true);
      Cookies.set('bookedReservation', JSON.stringify(fullReservationData), { expires: 7 });
      setIsReservationBooked(true);
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
      telephone: "",
      partySize: null,
      status: "active",
      additionalNotes: "",
    });
  };

  const handleCancelReservation = async () => {
    console.log("Cancel reservation called");
    try {
      if (bookedReservation?.reservationId) {
        const reservationRef = doc(db, 'reservations', bookedReservation.reservationId);
        await updateDoc(reservationRef, { status: 'canceled' });
        console.log('Reservation status updated to canceled:', bookedReservation.reservationId);
        setIsReservationBooked(false);
        setBookedReservation(null);
        Cookies.remove('bookedReservation');
      } else {
        console.log("No reservation ID found");
      }
    } catch (error) {
      console.error('Error canceling reservation:', error);
    }
  };

  useEffect(() => {
    const savedReservation = Cookies.get('bookedReservation');
    if (savedReservation) {
      const parsedReservation = JSON.parse(savedReservation);
      setBookedReservation(parsedReservation);
      setIsReservationBooked(true);
    }
  }, []);

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
            {!isReservationBooked ? (
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
                        selectedPartySize={formData.partySize || null}
                        onSelect={(time, partySize) => {
                          setFormData({ ...formData, time, partySize });
                        }}
                        disabled={!formData.date}
                      />
                    </div>
                    <div className="w-full my-auto mx-auto mt-3 lg:w-1/2 grid gap-4">

                      <Input
                        className="mb-6"
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
                        className="mb-6"
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
                        className="mb-6"
                        id="input-with-icon-adornment"
                        startAdornment={
                          <InputAdornment position="start">
                            <Mail />
                          </InputAdornment>
                        }
                        type="email"
                        placeholder="Email"
                        value={formData.email}
                        onChange={(e) => updateFormData({ email: e.target.value })}
                      />
                      <Input
                        className="mb-6"
                        id="input-with-icon-adornment"
                        startAdornment={
                          <InputAdornment position="start">
                            <Phone />
                          </InputAdornment>
                        }
                        type="tel"
                        placeholder="Telephone"
                        value={formData.telephone}
                        onChange={(e) => updateFormData({ telephone: e.target.value })}
                      />
                      <Input
                        className="mb-6"
                        id="input-with-icon-adornment"
                        startAdornment={
                          <InputAdornment position="start">
                            <Book />
                          </InputAdornment>
                        }
                        type="tel"
                        placeholder="Any accommodations needed? (Optional)"
                        value={formData.additionalNotes}
                        onChange={(e) => updateFormData({ additionalNotes: e.target.value })}
                      />
                      <div className="flex gap-2 mt-0">
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
            ) : (
              <Card>
                <CardContent>
                  <Typography variant="h5" gutterBottom>Your Reservation</Typography>
                  <Stack direction="row" spacing={2} className="mb-2">
                    <Typography variant="body1">Date:</Typography>
                    <Typography variant="body2">
                      {bookedReservation?.date && new Date(bookedReservation.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: '2-digit',
                        day: '2-digit',
                        year: '2-digit'
                      })}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={2} className="mb-2">
                    <Typography variant="body1">Time:</Typography>
                    <Typography variant="body2">{bookedReservation?.time}</Typography>
                  </Stack>
                  <Stack direction="row" spacing={2} className="mb-2">
                    <Typography variant="body1">Party Size:</Typography>
                    <Typography variant="body2">{bookedReservation?.partySize}</Typography>
                  </Stack>
                  <Stack direction="row" spacing={2} className="mb-2">
                    <Typography variant="body1">Name:</Typography>
                    <Typography variant="body2">{`${bookedReservation?.firstName} ${bookedReservation?.lastName}`}</Typography>
                  </Stack>
                  <Stack direction="row" spacing={2} className="mb-2">
                    <Typography variant="body1">Phone:</Typography>
                    <Typography variant="body2">{bookedReservation?.telephone}</Typography>
                  </Stack>
                  <Button
                    variant="contained"
                    color="error"
                    onClick={handleCancelReservation}
                    sx={{ mt: 2 }}
                  >
                    Cancel Reservation
                  </Button>
                </CardContent>
              </Card>
            )}
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

        {/* Confirmation Modal */}
        <div className={`fixed inset-0 z-50 overflow-y-auto ${openConfirmationModal ? 'flex' : 'hidden'} items-center justify-center`}>
          <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"></div>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 z-50 transform transition-all">
            <div className="bg-green-600 text-white px-6 py-4 rounded-t-lg">
              <h3 className="text-xl font-semibold">Reservation Confirmed</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-gray-700">Your reservation has been confirmed. An email will be sent regarding the details. If there are any issues we will reach out to you. Feel free to reach out to us if there are any changes or accommodations needed.</p>
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end">
              <Button
                onClick={() => setOpenConfirmationModal(false)}
                variant="contained"
                color="primary"
              >
                OK
              </Button>
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

function TimePicker({ selectedDate, selectedTime, selectedPartySize, onSelect, disabled }: {
  selectedDate: Date | null,
  selectedTime: string | null,
  selectedPartySize: number | null,
  onSelect: (time: string, partySize: number) => void,
  disabled: boolean
}) {
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [localSelectedTime, setLocalSelectedTime] = useState<string>("");
  const [localSelectedPartySize, setLocalSelectedPartySize] = useState<number | null>(null);
  const [isCustomSize, setIsCustomSize] = useState(false);

  useEffect(() => {
    setLocalSelectedTime(selectedTime || "");
  }, [selectedTime]);

  useEffect(() => {
    setLocalSelectedPartySize(selectedPartySize);
  }, [selectedPartySize]);

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

  const handleTimeChange = (event: SelectChangeEvent<string>) => {
    const newTime = event.target.value;
    setLocalSelectedTime(newTime);
    onSelect(newTime, localSelectedPartySize || 1);
  };

  const handlePartySizeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (value === 'custom') {
      setIsCustomSize(true);
      return;
    }
    const newPartySize = parseInt(value, 10);
    if (!isNaN(newPartySize) && newPartySize > 0 && newPartySize <= 50) {
      setLocalSelectedPartySize(newPartySize);
      onSelect(localSelectedTime, newPartySize);
    }
  };

  const handleCustomSizeBlur = () => {
    if (!localSelectedPartySize || localSelectedPartySize < 1 || localSelectedPartySize > 50) {
      setIsCustomSize(false);
      setLocalSelectedPartySize(null);
    }
  };

  const commonPartySizes = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  return (
    <div className="flex space-x-4 w-full">
      <FormControl size="small" disabled={disabled} className="w-full">
        <InputLabel id="time-select-label">Time</InputLabel>
        <Select
          labelId="time-select-label"
          id="time-select"
          value={localSelectedTime}
          label="Time"
          onChange={handleTimeChange}
          disabled={disabled}
          className="w-full"
        >
          <MenuItem value="" disabled>Select a time</MenuItem>
          {availableTimeSlots.map((slot) => (
            <MenuItem key={slot} value={slot}>
              {slot}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" disabled={disabled} className="w-full">
        {isCustomSize ? (
          <TextField
            label="Custom Party Size"
            type="number"
            value={localSelectedPartySize || ''}
            onChange={handlePartySizeChange}
            onBlur={handleCustomSizeBlur}
            disabled={disabled}
            inputProps={{ min: 1, max: 50 }}
            fullWidth
            size="small"
            variant="outlined"
          />
        ) : (
          <>
            <InputLabel id="party-size-label">Party Size</InputLabel>
            <Select
              labelId="party-size-label"
              value={localSelectedPartySize?.toString() || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePartySizeChange(e)}
              disabled={disabled}
              label="Party Size"
              fullWidth
            >
              {commonPartySizes.map(size => (
                <MenuItem key={size} value={size.toString()}>{size} {size === 1 ? 'person' : 'people'}</MenuItem>
              ))}
              <MenuItem value="custom">Custom Size</MenuItem>
            </Select>
          </>
        )}
      </FormControl>
    </div>
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
