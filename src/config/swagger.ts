import swaggerJSDoc from 'swagger-jsdoc';

const API_VERSION = '1.0.0';

export function buildOpenApiSpec(): unknown {
  return swaggerJSDoc({
    definition: {
      openapi: '3.0.3',
      info: {
        title: 'Huellitas API',
        version: API_VERSION,
      },
      servers: [{ url: '/api/v1' }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
        schemas: {
          ErrorResponse: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              error: { type: 'string' },
              code: { type: 'string', nullable: true },
            },
            required: ['success', 'error'],
          },
        },
        responses: {
          BadRequest: {
            description: 'Bad Request',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          Unauthorized: {
            description: 'Unauthorized',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          Forbidden: {
            description: 'Forbidden',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          NotFound: {
            description: 'Not Found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          Unprocessable: {
            description: 'Unprocessable Entity',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          TooManyRequests: {
            description: 'Too Many Requests',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          InternalServerError: {
            description: 'Internal Server Error',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
      paths: {
        '/users/me': {
          get: {
            security: [{ bearerAuth: [] }],
            summary: 'Get current user profile',
            responses: {
              '200': { description: 'OK' },
              '401': { $ref: '#/components/responses/Unauthorized' },
            },
          },
          patch: {
            security: [{ bearerAuth: [] }],
            summary: 'Patch current user profile',
            requestBody: {
              required: true,
              content: { 'application/json': { schema: { type: 'object' } } },
            },
            responses: {
              '200': { description: 'OK' },
              '400': { $ref: '#/components/responses/BadRequest' },
              '401': { $ref: '#/components/responses/Unauthorized' },
              '422': { $ref: '#/components/responses/Unprocessable' },
            },
          },
        },
        '/users/me/location': {
          patch: {
            security: [{ bearerAuth: [] }],
            summary: 'Update current user location',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { lat: { type: 'number' }, lng: { type: 'number' } },
                    required: ['lat', 'lng'],
                  },
                },
              },
            },
            responses: {
              '200': { description: 'OK' },
              '400': { $ref: '#/components/responses/BadRequest' },
              '401': { $ref: '#/components/responses/Unauthorized' },
            },
          },
        },
        '/users/me/push-token': {
          post: {
            security: [{ bearerAuth: [] }],
            summary: 'Register Expo/FCM push token',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      token: { type: 'string' },
                      platform: { type: 'string', enum: ['ios', 'android'] },
                    },
                    required: ['token', 'platform'],
                  },
                },
              },
            },
            responses: {
              '204': { description: 'No Content' },
              '401': { $ref: '#/components/responses/Unauthorized' },
              '422': { $ref: '#/components/responses/Unprocessable' },
            },
          },
          delete: {
            security: [{ bearerAuth: [] }],
            summary: 'Delete all push tokens for current user',
            responses: {
              '204': { description: 'No Content' },
              '401': { $ref: '#/components/responses/Unauthorized' },
            },
          },
        },
        '/pets': {
          get: {
            security: [{ bearerAuth: [] }],
            summary: 'List pets',
            responses: {
              '200': { description: 'OK' },
              '401': { $ref: '#/components/responses/Unauthorized' },
            },
          },
          post: {
            security: [{ bearerAuth: [] }],
            summary: 'Create pet',
            requestBody: {
              required: true,
              content: { 'application/json': { schema: { type: 'object' } } },
            },
            responses: {
              '201': { description: 'Created' },
              '401': { $ref: '#/components/responses/Unauthorized' },
              '422': { $ref: '#/components/responses/Unprocessable' },
            },
          },
        },
        '/pets/{petId}/photos': {
          post: {
            security: [{ bearerAuth: [] }],
            summary: 'Upload pet photo',
            parameters: [
              {
                name: 'petId',
                in: 'path',
                required: true,
                schema: { type: 'string', format: 'uuid' },
              },
            ],
            requestBody: {
              required: true,
              content: {
                'multipart/form-data': {
                  schema: {
                    type: 'object',
                    properties: { photo: { type: 'string', format: 'binary' } },
                  },
                },
              },
            },
            responses: {
              '201': { description: 'Created' },
              '400': { $ref: '#/components/responses/BadRequest' },
              '413': { description: 'Payload Too Large' },
            },
          },
        },
        '/lost-reports/nearby': {
          get: {
            security: [{ bearerAuth: [] }],
            summary: 'Find nearby active lost reports',
            parameters: [
              { name: 'lat', in: 'query', required: true, schema: { type: 'number' } },
              { name: 'lng', in: 'query', required: true, schema: { type: 'number' } },
              {
                name: 'radius',
                in: 'query',
                required: false,
                schema: { type: 'number', default: 5 },
              },
              { name: 'species', in: 'query', required: false, schema: { type: 'string' } },
            ],
            responses: {
              '200': { description: 'OK' },
              '400': { $ref: '#/components/responses/BadRequest' },
            },
          },
        },
        '/lost-reports': {
          post: {
            security: [{ bearerAuth: [] }],
            summary: 'Create lost report',
            requestBody: {
              required: true,
              content: { 'application/json': { schema: { type: 'object' } } },
            },
            responses: {
              '201': { description: 'Created' },
              '400': { $ref: '#/components/responses/BadRequest' },
              '401': { $ref: '#/components/responses/Unauthorized' },
            },
          },
        },
        '/lost-reports/{id}/sightings': {
          get: {
            security: [{ bearerAuth: [] }],
            summary: 'List sightings for a report (owner only)',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string', format: 'uuid' },
              },
            ],
            responses: {
              '200': { description: 'OK' },
              '401': { $ref: '#/components/responses/Unauthorized' },
              '403': { $ref: '#/components/responses/Forbidden' },
            },
          },
          post: {
            security: [{ bearerAuth: [] }],
            summary: 'Create sighting for a report',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string', format: 'uuid' },
              },
            ],
            requestBody: {
              required: true,
              content: {
                'multipart/form-data': {
                  schema: {
                    type: 'object',
                    properties: {
                      lat: { type: 'number' },
                      lng: { type: 'number' },
                      photo: { type: 'string', format: 'binary' },
                    },
                  },
                },
              },
            },
            responses: {
              '201': { description: 'Created' },
              '400': { $ref: '#/components/responses/BadRequest' },
              '401': { $ref: '#/components/responses/Unauthorized' },
            },
          },
        },
        '/lost-reports/{id}/resolve': {
          patch: {
            security: [{ bearerAuth: [] }],
            summary: 'Resolve lost report (owner only)',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string', format: 'uuid' },
              },
            ],
            responses: {
              '204': { description: 'No Content' },
              '401': { $ref: '#/components/responses/Unauthorized' },
              '403': { $ref: '#/components/responses/Forbidden' },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
    apis: [],
  });
}
