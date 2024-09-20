import { useState, useEffect } from 'react';
import { collection, getDocs, DocumentData, query, where, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Box, Button, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Container, TextField, Menu, MenuItem, IconButton, Tooltip, Fab, Modal, FormControl, InputLabel, Select, SelectChangeEvent } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddIcon from '@mui/icons-material/Add';

interface Reservation extends DocumentData {
  id: string;
  date: string;
  time: string;
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
  partySize: number;
  status: string;
  additionalNotes: string;
}

interface NewReservation {
  date: string;
  time: string;
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
  partySize: number;
  status: string;
  additionalNotes: string;
}

export default function Dashboard() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [openModal, setOpenModal] = useState(false);
  const [newReservation, setNewReservation] = useState<NewReservation>({
    date: '',
    time: '',
    firstName: '',
    lastName: '',
    email: '',
    telephone: '',
    partySize: 1,
    status: 'active',
    additionalNotes: '',
  });

  useEffect(() => {
    fetchReservations();
  }, [selectedDate]);

  const convertTo12HourFormat = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12; // Convert 0 to 12 for midnight
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const fetchReservations = async () => {
    console.log("Fetching reservations for date:", selectedDate);

    const reservationsRef = collection(db, 'reservations');
    const startOfDay = new Date(selectedDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const startDateString = startOfDay.toISOString();
    const endDateString = endOfDay.toISOString();

    console.log("Query range:", startDateString, "to", endDateString);

    const q = query(
      reservationsRef,
      where("date", ">=", startDateString),
      where("date", "<=", endDateString)
    );

    const querySnapshot = await getDocs(q);
    console.log("Number of reservations found:", querySnapshot.size);

    const reservationData = querySnapshot.docs.map(doc => {
      const data = doc.data();
      console.log("Raw reservation data:", data);
      const reservationDate = new Date(data.date);
      return {
        id: doc.id,
        ...data,
        date: reservationDate.toUTCString().split(' ')[0], // Get only the date part

      };
    }) as Reservation[];

    console.log("Processed reservation data:", reservationData);
    setReservations(reservationData);
  };
  const formatPhoneNumber = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setUTCDate(newDate.getUTCDate() + days);
    setSelectedDate(newDate.toISOString().split('T')[0]);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>, reservation: Reservation) => {
    setAnchorEl(event.currentTarget);
    setSelectedReservation(reservation);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedReservation(null);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (selectedReservation) {
      const reservationRef = doc(db, 'reservations', selectedReservation.id);
      await updateDoc(reservationRef, { status: newStatus });
      fetchReservations();
      handleMenuClose();
    }
  };

  const handleCancelReservation = () => handleStatusChange('cancelled');
  const handleCompleteReservation = () => handleStatusChange('completed');

  const handleEditReservation = () => {
    // Implement edit functionality here
    console.log('Edit reservation:', selectedReservation);
    handleMenuClose();
  };

  const handleOpenModal = () => setOpenModal(true);
  const handleCloseModal = () => setOpenModal(false);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setNewReservation({ ...newReservation, [name]: value });
  };

  const handleSelectChange = (event: SelectChangeEvent<string | number>) => {
    const { name, value } = event.target;
    setNewReservation({ ...newReservation, [name]: value });
  };

  const handleCreateReservation = async () => {
    try {
      const [year, month, day] = newReservation.date.split('-');
      const [hours, minutes] = newReservation.time.split(':');

      const dateTime = new Date(Date.UTC(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hours),
        parseInt(minutes)
      ));

      const formattedDate = dateTime.toISOString();

      const reservationData = {
        ...newReservation,
        date: formattedDate,
      };

      await addDoc(collection(db, 'reservations'), { ...reservationData, telephone: formatPhoneNumber(reservationData.telephone) });
      handleCloseModal();
      fetchReservations();

      // Reset the form
      setNewReservation({
        date: '',
        time: '',
        firstName: '',
        lastName: '',
        email: '',
        telephone: '',
        partySize: 1,
        status: 'active',
        additionalNotes: '',
      });
    } catch (error) {
      console.error('Error creating reservation:', error);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, position: 'relative', minHeight: '100vh' }}>
      <Typography variant="h4" gutterBottom align="center">
        Reservations
      </Typography>
      <Box display="flex" justifyContent="center" alignItems="center" mb={2}>
        <Button onClick={() => changeDate(-1)}>Previous Day</Button>
        <TextField
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          sx={{ mx: 2 }}
        />
        <Button onClick={() => changeDate(1)}>Next Day</Button>
      </Box>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Time</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Telephone</TableCell>
              <TableCell>Party Size</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Additional Notes</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reservations.map((reservation) => (
              <TableRow key={reservation.id}>
                <TableCell>{Number(reservation.time.split(':')[0]) > 12 ? convertTo12HourFormat(reservation.time) : reservation.time}</TableCell>
                <TableCell>{`${reservation.firstName} ${reservation.lastName}`}</TableCell>
                <TableCell>{reservation.email}</TableCell>
                <TableCell>{reservation.telephone}</TableCell>
                <TableCell>{reservation.partySize}</TableCell>
                <TableCell>{reservation.status || 'active'}</TableCell>
                <TableCell>
                  {reservation.additionalNotes ? (
                    <Tooltip title={reservation.additionalNotes}>
                      <span>{reservation.additionalNotes.slice(0, 20)}...</span>
                    </Tooltip>
                  ) : (
                    'N/A'
                  )}
                </TableCell>
                <TableCell>
                  <IconButton onClick={(event) => handleMenuOpen(event, reservation)}>
                    <MoreVertIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleCompleteReservation}>Mark as Completed</MenuItem>
        <MenuItem onClick={handleCancelReservation}>Cancel Reservation</MenuItem>
        <MenuItem onClick={handleEditReservation}>Edit Reservation</MenuItem>
      </Menu>

      <Fab
        color="primary"
        aria-label="add"
        style={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={handleOpenModal}
      >
        <AddIcon />
      </Fab>

      <Modal
        open={openModal}
        onClose={handleCloseModal}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 400,
          bgcolor: 'background.paper',
          boxShadow: 24,
          p: 4,
        }}>
          <Typography id="modal-modal-title" variant="h6" component="h2">
            Create New Reservation
          </Typography>
          <TextField
            margin="normal"
            required
            fullWidth
            id="date"
            label="Date"
            name="date"
            type="date"
            value={newReservation.date}
            onChange={handleInputChange}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            id="time"
            label="Time"
            name="time"
            type="time"
            value={newReservation.time}
            onChange={handleInputChange}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            id="firstName"
            label="First Name"
            name="firstName"
            value={newReservation.firstName}
            onChange={handleInputChange}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            id="lastName"
            label="Last Name"
            name="lastName"
            value={newReservation.lastName}
            onChange={handleInputChange}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email"
            name="email"
            type="email"
            value={newReservation.email}
            onChange={handleInputChange}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            id="telephone"
            label="Telephone"
            name="telephone"
            value={newReservation.telephone}
            onChange={handleInputChange}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel id="party-size-label">Party Size</InputLabel>
            <Select
              labelId="party-size-label"
              id="partySize"
              name="partySize"
              value={newReservation.partySize}
              label="Party Size"
              onChange={handleSelectChange}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((size) => (
                <MenuItem key={size} value={size}>{size}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            margin="normal"
            fullWidth
            id="additionalNotes"
            label="Additional Notes"
            name="additionalNotes"
            multiline
            rows={4}
            value={newReservation.additionalNotes}
            onChange={handleInputChange}
          />
          <Button
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            onClick={handleCreateReservation}
          >
            Create Reservation
          </Button>
        </Box>
      </Modal>
    </Container>
  );
}