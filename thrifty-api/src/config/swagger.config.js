export const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "Thrifty API",
    version: "1.0.0",
    description:
      "REST API for Thrifty — a digital cooperative savings platform (ajo/esusu) for Nigeria. Handles user auth, BVN KYC, savings groups, Paystack direct debit, and payouts.",
    contact: {
      name: "Ifeanyi Nwankwo",
      url: "https://github.com/Kingsley-coder-prog",
    },
  },
  servers: [
    {
      url: "https://thrifty-api-server.onrender.com",
      description: "Production",
    },
    {
      url: "http://localhost:3000",
      description: "Local development",
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "JWT access token. Obtain from /auth/login or /auth/register.",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string", example: "UNAUTHORIZED" },
          message: { type: "string", example: "Invalid or expired token" },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          phone: { type: "string", example: "08012345678" },
          fullName: { type: "string", example: "Test User" },
          email: {
            type: "string",
            example: "test@example.com",
            nullable: true,
          },
          kyc_status: {
            type: "string",
            enum: ["none", "bvn_verified"],
            example: "bvn_verified",
          },
          kyc_level: { type: "integer", example: 1 },
          status: {
            type: "string",
            enum: ["active", "frozen"],
            example: "active",
          },
          created_at: { type: "string", format: "date-time" },
        },
      },
      Group: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          tier_id: { type: "string", format: "uuid" },
          tier_name: { type: "string", example: "Bronze" },
          status: {
            type: "string",
            enum: ["forming", "active", "completed", "frozen"],
            example: "forming",
          },
          monthly_amount: { type: "number", example: 25000 },
          total_payout: { type: "number", example: 175000 },
          member_count: { type: "integer", example: 2 },
          max_members: { type: "integer", example: 7 },
          created_at: { type: "string", format: "date-time" },
        },
      },
      Tier: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", example: "Bronze" },
          description: {
            type: "string",
            example: "Entry level — ₦25,000 monthly contribution",
          },
          monthly_amount: { type: "number", example: 25000 },
          total_payout: { type: "number", example: 175000 },
          platform_fee_pct: { type: "number", example: 1.0 },
          min_kyc_level: { type: "integer", example: 1 },
        },
      },
      Contribution: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          user_id: { type: "string", format: "uuid" },
          group_id: { type: "string", format: "uuid" },
          amount: { type: "number", example: 25000 },
          status: {
            type: "string",
            enum: ["pending", "success", "failed"],
            example: "success",
          },
          cycle_month: { type: "string", example: "2026-05" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      Payout: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          user_id: { type: "string", format: "uuid" },
          group_id: { type: "string", format: "uuid" },
          amount: { type: "number", example: 175000 },
          status: {
            type: "string",
            enum: ["pending", "processing", "success", "failed"],
            example: "success",
          },
          created_at: { type: "string", format: "date-time" },
        },
      },
      BankAccount: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          bank_name: { type: "string", example: "Providus Bank" },
          bank_code: { type: "string", example: "058" },
          account_token: { type: "string", example: "tok_058_d434ba8021..." },
          is_default: { type: "boolean", example: true },
        },
      },
    },
  },
  security: [{ BearerAuth: [] }],
  tags: [
    { name: "Auth", description: "Registration, login, token refresh" },
    { name: "Users", description: "User profile and bank accounts" },
    { name: "KYC", description: "BVN verification and KYC levels" },
    { name: "Groups", description: "Savings group browsing and joining" },
    { name: "Tiers", description: "Available savings tiers" },
    { name: "Contributions", description: "Monthly contribution records" },
    { name: "Payouts", description: "Payout history and status" },
    { name: "Webhooks", description: "Paystack event handlers (internal)" },
    { name: "Admin — Auth", description: "Admin login" },
    { name: "Admin — Dashboard", description: "Platform stats" },
    { name: "Admin — Users", description: "User management" },
    { name: "Admin — Groups", description: "Group management" },
    { name: "Admin — Finance", description: "Contributions and payouts" },
    {
      name: "Admin — Compliance",
      description: "Fraud flags, disputes, audit logs",
    },
    { name: "Health", description: "Server health check" },
  ],
  paths: {
    // ── HEALTH ────────────────────────────────────────────────────────
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        security: [],
        responses: {
          200: {
            description: "Server is running",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    env: { type: "string", example: "production" },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ── AUTH ──────────────────────────────────────────────────────────
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new user",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["phone", "password", "fullName"],
                properties: {
                  phone: { type: "string", example: "08012345678" },
                  password: { type: "string", example: "Password123!" },
                  fullName: { type: "string", example: "Test User" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "User registered — returns user + access token" },
          400: { description: "Validation error or phone already registered" },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login with phone and password",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["phone", "password"],
                properties: {
                  phone: { type: "string", example: "08012345678" },
                  password: { type: "string", example: "Password123!" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Login successful — returns user + access token",
          },
          401: { description: "Invalid credentials" },
        },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Refresh access token",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["refreshToken"],
                properties: {
                  refreshToken: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "New access token returned" },
          401: { description: "Invalid or expired refresh token" },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout and invalidate token",
        responses: {
          200: { description: "Logged out successfully" },
          401: { description: "Unauthorized" },
        },
      },
    },

    // ── USERS ─────────────────────────────────────────────────────────
    "/users/me": {
      get: {
        tags: ["Users"],
        summary: "Get current user profile",
        responses: {
          200: {
            description: "User profile",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
              },
            },
          },
          401: { description: "Unauthorized" },
        },
      },
      patch: {
        tags: ["Users"],
        summary: "Update profile (email, fullName)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  fullName: { type: "string", example: "Updated Name" },
                  email: { type: "string", example: "email@example.com" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Profile updated" },
          400: { description: "Validation error" },
        },
      },
    },
    "/users/me/bank-accounts": {
      get: {
        tags: ["Users"],
        summary: "Get linked bank accounts",
        responses: {
          200: {
            description: "List of bank accounts",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/BankAccount" },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Users"],
        summary: "Add a bank account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["bank_code", "account_number"],
                properties: {
                  bank_code: { type: "string", example: "058" },
                  account_number: { type: "string", example: "0123456789" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Bank account added and tokenised via Paystack" },
          400: { description: "Invalid account details" },
        },
      },
    },

    // ── KYC ───────────────────────────────────────────────────────────
    "/users/me/kyc/bvn": {
      post: {
        tags: ["KYC"],
        summary: "Submit BVN for verification",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["bvn"],
                properties: {
                  bvn: {
                    type: "string",
                    example: "12345678901",
                    description: "11-digit BVN",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "BVN verified — KYC level upgraded" },
          400: { description: "Invalid BVN format" },
          422: { description: "BVN verification failed via provider" },
        },
      },
    },

    // ── TIERS ─────────────────────────────────────────────────────────
    "/tiers": {
      get: {
        tags: ["Tiers"],
        summary: "List all savings tiers",
        security: [],
        responses: {
          200: {
            description: "List of tiers (Bronze, Silver, Gold, Platinum)",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Tier" },
                },
              },
            },
          },
        },
      },
    },

    // ── GROUPS ────────────────────────────────────────────────────────
    "/groups": {
      get: {
        tags: ["Groups"],
        summary: "Browse available groups",
        parameters: [
          {
            name: "tier",
            in: "query",
            schema: { type: "string" },
            description: "Filter by tier name e.g. Bronze",
          },
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["forming", "active"] },
            description: "Filter by group status",
          },
        ],
        responses: {
          200: {
            description: "List of groups",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Group" },
                },
              },
            },
          },
        },
      },
    },
    "/groups/me": {
      get: {
        tags: ["Groups"],
        summary: "Get current user's groups",
        responses: {
          200: { description: "User's group memberships" },
        },
      },
    },
    "/groups/{id}/join": {
      post: {
        tags: ["Groups"],
        summary: "Join a savings group",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Group ID",
          },
        ],
        responses: {
          200: { description: "Joined group successfully" },
          400: { description: "Group is full or already a member" },
          403: { description: "KYC level too low for this tier" },
        },
      },
    },

    // ── CONTRIBUTIONS ─────────────────────────────────────────────────
    "/contributions/me": {
      get: {
        tags: ["Contributions"],
        summary: "Get current user's contribution history",
        responses: {
          200: {
            description: "List of contributions",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Contribution" },
                },
              },
            },
          },
        },
      },
    },

    // ── PAYOUTS ───────────────────────────────────────────────────────
    "/payouts/me": {
      get: {
        tags: ["Payouts"],
        summary: "Get current user's payout history",
        responses: {
          200: {
            description: "List of payouts",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Payout" },
                },
              },
            },
          },
        },
      },
    },

    // ── WEBHOOKS ──────────────────────────────────────────────────────
    "/webhooks/paystack": {
      post: {
        tags: ["Webhooks"],
        summary: "Paystack event webhook handler",
        description:
          "Receives charge.success, transfer.success, transfer.failed events from Paystack. Verified via HMAC-SHA512 signature. **Not for direct use.**",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: {
          200: { description: "Event received" },
          400: { description: "Invalid signature" },
        },
      },
    },

    // ── ADMIN AUTH ────────────────────────────────────────────────────
    "/admin/auth/login": {
      post: {
        tags: ["Admin — Auth"],
        summary: "Admin login",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", example: "admin@thrifty.ng" },
                  password: { type: "string", example: "AdminPassword123!" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Login successful — returns admin + JWT" },
          401: { description: "Invalid credentials" },
          403: { description: "Not an admin account" },
        },
      },
    },

    // ── ADMIN DASHBOARD ───────────────────────────────────────────────
    "/admin/dashboard": {
      get: {
        tags: ["Admin — Dashboard"],
        summary: "Platform overview stats",
        description:
          "Returns total users, active/frozen counts, group stats, and finance summary.",
        responses: {
          200: { description: "Dashboard stats" },
          401: { description: "Unauthorized" },
          403: { description: "Admin access required" },
        },
      },
    },

    // ── ADMIN USERS ───────────────────────────────────────────────────
    "/admin/users": {
      get: {
        tags: ["Admin — Users"],
        summary: "List all users",
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 20 },
          },
          {
            name: "search",
            in: "query",
            schema: { type: "string" },
            description: "Search by phone or name",
          },
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["active", "frozen"] },
          },
        ],
        responses: {
          200: { description: "Paginated user list" },
        },
      },
    },
    "/admin/users/{id}": {
      get: {
        tags: ["Admin — Users"],
        summary: "Get full user detail",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: { description: "User detail including groups, KYC, BVN status" },
          404: { description: "User not found" },
        },
      },
    },
    "/admin/users/{id}/freeze": {
      post: {
        tags: ["Admin — Users"],
        summary: "Freeze a user account",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  reason: {
                    type: "string",
                    example: "Suspicious activity detected",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Account frozen" },
          404: { description: "User not found" },
        },
      },
    },
    "/admin/users/{id}/unfreeze": {
      post: {
        tags: ["Admin — Users"],
        summary: "Unfreeze a user account",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  reason: { type: "string", example: "Issue resolved" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Account unfrozen" },
          404: { description: "User not found" },
        },
      },
    },

    // ── ADMIN GROUPS ──────────────────────────────────────────────────
    "/admin/groups": {
      get: {
        tags: ["Admin — Groups"],
        summary: "List all groups",
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 20 },
          },
          { name: "tier", in: "query", schema: { type: "string" } },
          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: ["forming", "active", "completed", "frozen"],
            },
          },
        ],
        responses: {
          200: { description: "Paginated group list" },
        },
      },
    },

    // ── ADMIN FINANCE ─────────────────────────────────────────────────
    "/admin/contributions": {
      get: {
        tags: ["Admin — Finance"],
        summary: "Full contribution ledger",
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 20 },
          },
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["pending", "success", "failed"] },
          },
        ],
        responses: {
          200: { description: "Paginated contribution list" },
        },
      },
    },
    "/admin/payouts": {
      get: {
        tags: ["Admin — Finance"],
        summary: "All payouts",
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 20 },
          },
          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: ["pending", "processing", "success", "failed"],
            },
          },
        ],
        responses: {
          200: { description: "Paginated payout list" },
        },
      },
    },

    // ── ADMIN COMPLIANCE ──────────────────────────────────────────────
    "/admin/fraud": {
      get: {
        tags: ["Admin — Compliance"],
        summary: "List fraud flags",
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["open", "resolved", "dismissed"] },
          },
        ],
        responses: {
          200: { description: "Fraud flags list" },
        },
      },
    },
    "/admin/disputes": {
      get: {
        tags: ["Admin — Compliance"],
        summary: "List disputes",
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["open", "resolved"] },
          },
        ],
        responses: {
          200: { description: "Disputes list" },
        },
      },
    },
    "/admin/audit": {
      get: {
        tags: ["Admin — Compliance"],
        summary: "Admin audit logs",
        description: "Complete trail of all admin actions.",
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 50 },
          },
        ],
        responses: {
          200: { description: "Paginated audit log" },
        },
      },
    },
  },
};
