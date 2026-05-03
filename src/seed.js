require('dotenv').config();
const connectDB = require('./config/db');
const User = require('./models/User');
const Student = require('./models/Student');
const Lesson = require('./models/Lesson');
const Availability = require('./models/Availability');

const run = async () => {
  await connectDB();

  await Promise.all([
    User.deleteMany({}),
    Student.deleteMany({}),
    Lesson.deleteMany({}),
    Availability.deleteMany({})
  ]);

  const admin = await User.create({
    name: 'Admin User',
    email: 'admin@drivingschool.com',
    password: 'Admin123',
    role: 'admin',
    phone: '020 0000 0000'
  });

  const john = await User.create({
    name: 'John Carter',
    email: 'john@drivingschool.com',
    password: 'Instructor123',
    role: 'instructor',
    phone: '07123 456789',
    postalCodes: ['E1', 'E2', 'N1']
  });

  const sara = await User.create({
    name: 'Sara Ahmed',
    email: 'sara@drivingschool.com',
    password: 'Instructor123',
    role: 'instructor',
    phone: '07987 654321',
    postalCodes: ['SW1', 'SW2', 'W1']
  });

  const students = await Student.insertMany([
    {
      firstName: 'Michael',
      lastName: 'Brown',
      email: 'michael@example.com',
      phone: '07111 111111',
      postalCode: 'E1',
      status: 'active',
      assignedInstructor: john._id,
      notes: 'Prefers weekend lessons.'
    },
    {
      firstName: 'Aisha',
      lastName: 'Khan',
      email: 'aisha@example.com',
      phone: '07222 222222',
      postalCode: 'SW1',
      status: 'assigned',
      assignedInstructor: sara._id
    },
    {
      firstName: 'Daniel',
      lastName: 'Smith',
      email: 'daniel@example.com',
      phone: '07333 333333',
      postalCode: 'N1',
      status: 'new',
      assignedInstructor: john._id
    }
  ]);

  await Availability.insertMany([
    { instructor: john._id, dayOfWeek: 'Monday', startTime: '09:00', endTime: '17:00' },
    { instructor: john._id, dayOfWeek: 'Wednesday', startTime: '10:00', endTime: '18:00' },
    { instructor: sara._id, dayOfWeek: 'Tuesday', startTime: '09:00', endTime: '16:00' },
    { instructor: sara._id, dayOfWeek: 'Friday', startTime: '11:00', endTime: '19:00' }
  ]);

  await Lesson.create({
    student: students[0]._id,
    instructor: john._id,
    date: new Date().toISOString().slice(0, 10),
    startTime: '10:00',
    endTime: '11:00',
    pickupLocation: 'Student home',
    status: 'scheduled'
  });

  console.log('Seed completed');
  console.log('Admin: admin@drivingschool.com / Admin123');
  console.log('Instructor: john@drivingschool.com / Instructor123');
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
