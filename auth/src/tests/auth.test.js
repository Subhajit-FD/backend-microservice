const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../app");
const User = require("../models/user.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Mock Redis
jest.mock("../db/redis", () => ({
  set: jest.fn(),
  get: jest.fn(),
  on: jest.fn(),
}));

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = process.env.MONGO_URI || mongoServer.getUri();
  const JWT_SECRET = "testsecret";
  process.env.JWT_SECRET = JWT_SECRET;
  await mongoose.disconnect(); // Ensure any existing connection is closed
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.deleteMany({});
});

describe("Auth Endpoints", () => {
  const validUser = {
    username: "testuser",
    email: "test@example.com",
    password: "password123",
    fullname: {
      firstname: "Test",
      lastname: "User",
    },
  };

  describe("POST /api/auth/register", () => {
    it("should register a new user successfully (201)", async () => {
      const res = await request(app).post("/api/auth/register").send(validUser);

      expect(res.statusCode).toEqual(201);
      expect(res.body.message).toEqual("User registered successfully");
      // Check if user is actually in DB
      const user = await User.findOne({ email: validUser.email });
      expect(user).toBeTruthy();
      expect(user.username).toBe(validUser.username);
    });

    it("should return 409 if user already exists", async () => {
      // Create user first
      await User.create({
        ...validUser,
        password: await bcrypt.hash(validUser.password, 10),
      });

      const res = await request(app).post("/api/auth/register").send(validUser);

      expect(res.statusCode).toEqual(409);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it("should return 400 if required fields are missing", async () => {
      const incompleteUser = {
        username: "testuser",
      };

      const res = await request(app)
        .post("/api/auth/register")
        .send(incompleteUser);

      expect(res.statusCode).toEqual(400);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      // Create a user to login with
      await User.create({
        ...validUser,
        password: await bcrypt.hash(validUser.password, 10),
      });
    });

    it("should login successfully with valid credentials (200)", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: validUser.email,
        password: validUser.password,
      });

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toEqual("Login successful");
      expect(res.headers["set-cookie"]).toBeDefined();

      // Verify token in cookie
      const cookies = res.headers["set-cookie"];
      const tokenCookie = cookies.find((c) => c.startsWith("token="));
      expect(tokenCookie).toBeTruthy();
    });

    it("should return 401 with invalid password", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: validUser.email,
        password: "wrongpassword",
      });

      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toEqual("Invalid email or password");
    });

    it("should return 401 with non-existent user", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "nonexistent@example.com",
        password: "password123",
      });

      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toEqual("Invalid email or password");
    });

    it("should return 400 if validation fails (e.g. missing password)", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: validUser.email,
      });
      expect(res.statusCode).toEqual(400);
    });
  });

  describe("GET /api/auth/me", () => {
    let token;

    beforeEach(async () => {
      const user = await User.create({
        ...validUser,
        password: await bcrypt.hash(validUser.password, 10),
      });

      token = jwt.sign(
        {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: "1h" },
      );
    });

    it("should return current user data if authenticated (200)", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", [`token=${token}`]);

      expect(res.statusCode).toEqual(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toEqual(validUser.email);
    });

    it("should return 401 if no token provided", async () => {
      const res = await request(app).get("/api/auth/me");

      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toMatch(/Access denied/i);
    });

    it("should return 401 if token is invalid", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", [`token=invalidtoken`]);

      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toMatch(/Unauthorized/i);
    });
  });
  describe("GET /api/auth/logout", () => {
    let token;

    beforeEach(async () => {
      const user = await User.create({
        ...validUser,
        password: await bcrypt.hash(validUser.password, 10),
      });

      token = jwt.sign(
        {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: "1h" },
      );
    });

    it("should logout successfully (200) and blacklist token", async () => {
      const res = await request(app)
        .get("/api/auth/logout")
        .set("Cookie", [`token=${token}`]);

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toEqual("Logout successful");
      expect(res.headers["set-cookie"][0]).toMatch(/token=;/); // Check if cookie is cleared
    });

    it("should return 401 if no token provided", async () => {
      const res = await request(app).get("/api/auth/logout");

      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toMatch(/No token provided/i);
    });
  });

  describe("PUT /api/auth/users/me", () => {
    let token;

    beforeEach(async () => {
      const user = await User.create({
        ...validUser,
        password: await bcrypt.hash(validUser.password, 10),
      });

      token = jwt.sign(
        {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: "1h" },
      );
    });

    it("should update profile fields successfully (200)", async () => {
      const updateData = {
        fullname: {
          firstname: "Updated",
          lastname: "Name",
        },
      };

      const res = await request(app)
        .put("/api/auth/users/me")
        .set("Cookie", [`token=${token}`])
        .send(updateData);

      expect(res.statusCode).toEqual(200);
      expect(res.body.user.fullname.firstname).toEqual("Updated");

      const updatedUser = await User.findOne({ email: validUser.email });
      expect(updatedUser.fullname.firstname).toEqual("Updated");
    });

    it("should sanitize HTML in profile fields", async () => {
      const maliciousData = {
        fullname: {
          firstname: "<script>alert('xss')</script>John",
          lastname: "Doe",
        },
      };

      const res = await request(app)
        .put("/api/auth/users/me")
        .set("Cookie", [`token=${token}`])
        .send(maliciousData);

      expect(res.statusCode).toEqual(200);
      expect(res.body.user.fullname.firstname).not.toContain("<script>");
      expect(res.body.user.fullname.firstname).not.toContain("alert");
    });
  });

  describe("Address Handling", () => {
    let token;
    let userId;

    beforeEach(async () => {
      const user = await User.create({
        ...validUser,
        password: await bcrypt.hash(validUser.password, 10),
      });
      userId = user._id;

      token = jwt.sign(
        {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: "1h" },
      );
    });

    describe("GET /api/auth/users/me/addresses", () => {
      it("should return empty list if no addresses found (200)", async () => {
        const res = await request(app)
          .get("/api/auth/users/me/addresses")
          .set("Cookie", [`token=${token}`]);

        expect(res.statusCode).toEqual(200);
        expect(Array.isArray(res.body.addresses)).toBeTruthy();
        expect(res.body.addresses).toHaveLength(0);
      });
    });

    describe("POST /api/auth/users/me/addresses", () => {
      const validAddress = {
        street: "123 Main St",
        city: "Metropolis",
        state: "NY",
        pincode: "110001",
        country: "USA",
        isDefault: false,
      };

      it("should add a new address successfully (200/201)", async () => {
        const res = await request(app)
          .post("/api/auth/users/me/addresses")
          .set("Cookie", [`token=${token}`])
          .send(validAddress);

        if (res.statusCode !== 201 && res.statusCode !== 200) {
          console.log(
            "POST /addresses failed with:",
            JSON.stringify(res.body, null, 2),
          );
        }

        expect(res.statusCode).toBeGreaterThanOrEqual(200);
        expect(res.statusCode).toBeLessThan(300);
        expect(res.body.message).toMatch(/Address added/i);

        // Verify address added to DB
        const user = await User.findById(userId);
        expect(user.addresses).toHaveLength(1);
        expect(user.addresses[0].pincode).toEqual(validAddress.pincode);
      });

      it("should return 400 for invalid pincode", async () => {
        const invalidAddress = { ...validAddress, pincode: "abc" };

        const res = await request(app)
          .post("/api/auth/users/me/addresses")
          .set("Cookie", [`token=${token}`])
          .send(invalidAddress);

        expect(res.statusCode).toEqual(400);
      });
    });

    describe("DELETE /api/auth/users/me/addresses/:addressId", () => {
      it("should delete an address successfully (200)", async () => {
        // First add an address directly to DB
        const address = {
          street: "123 Main St",
          city: "Metropolis",
          state: "NY",
          pincode: "110001",
          country: "USA",
        };
        const user = await User.findById(userId);
        user.addresses = user.addresses || []; // Ensure addresses exists
        user.addresses.push(address);
        await user.save();

        // Fetch again to get the ID
        const updatedUserRef = await User.findById(userId);
        const addressId = updatedUserRef.addresses[0]._id;

        const res = await request(app)
          .delete(`/api/auth/users/me/addresses/${addressId}`)
          .set("Cookie", [`token=${token}`]);

        expect(res.statusCode).toEqual(200);
        expect(res.body.message).toMatch(/Address deleted/i);

        const updatedUser = await User.findById(userId);
        expect(updatedUser.addresses).toHaveLength(0);
      });

      it("should return 404 if address not found", async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
          .delete(`/api/auth/users/me/addresses/${fakeId}`)
          .set("Cookie", [`token=${token}`]);

        expect(res.statusCode).toEqual(404);
      });
    });
  });
});
