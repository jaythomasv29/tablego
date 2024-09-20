import { useState, useEffect } from 'react';
import { collection, getDocs, DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import { Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';

interface Reservation extends DocumentData {
  id: string;
  date: string;
  time: string;
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
}

export default function Dashboard() {
  const [reservations, setReservations] = useState<Reservation[]>([]);

  useEffect(() => {
    const fetchReservations = async () => {
      const querySnapshot = await getDocs(collection(db, 'reservations'));
      const reservationData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Reservation[];
      setReservations(reservationData);
    };

    fetchReservations();
  }, []);

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Reservations
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Time</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Telephone</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reservations.map((reservation) => (
              <TableRow key={reservation.id}>
                <TableCell>{reservation.date}</TableCell>
                <TableCell>{reservation.time}</TableCell>
                <TableCell>{`${reservation.firstName} ${reservation.lastName}`}</TableCell>
                <TableCell>{reservation.email}</TableCell>
                <TableCell>{reservation.telephone}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}