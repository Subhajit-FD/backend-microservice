const app = require('./src/app');
const connectDB = require('./src/db/db');

// Connect to MongoDB
connectDB();

const PORT = process.env.PORT || 3000;


app.listen(PORT, () => {
  console.log(`Auth service is running on port ${PORT}`);
});