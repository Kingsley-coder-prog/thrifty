import swaggerUi from "swagger-ui-express";
import { swaggerDocument } from "./swagger.config.js";

export function setupSwagger(app) {
  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, {
      customSiteTitle: "Thrifty API Docs",
      customCss: `
        .topbar { background-color: #166534; }
        .topbar-wrapper img { display: none; }
        .topbar-wrapper::after {
          content: 'Thrifty API';
          color: white;
          font-size: 1.2rem;
          font-weight: 700;
          letter-spacing: -0.5px;
        }
      `,
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: "none",
        filter: true,
        tagsSorter: "alpha",
      },
    }),
  );

  // Also expose the raw JSON spec for tools like Postman
  app.get("/api/docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerDocument);
  });
}
