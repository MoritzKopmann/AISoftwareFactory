// HTTP DTOs: shaped for the frontend / public API. JSON-serializable (no Date, no classes).

/** Request body for POST /users. */
export interface RegisterUserRequest {
  email: string;
  name: string;
}

/** Response body. */
export interface UserDto {
  id: string;
  email: string;
  name: string;
}
