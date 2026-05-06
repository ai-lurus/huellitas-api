declare module 'swagger-jsdoc' {
  type SwaggerJSDocOptions = {
    definition: unknown;
    apis: string[];
  };

  export default function swaggerJSDoc(options: SwaggerJSDocOptions): Record<string, unknown>;
}
