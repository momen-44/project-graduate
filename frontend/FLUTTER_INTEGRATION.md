Flutter Integration Guide - Auth + Image Upload

Overview

- Base URL: http://localhost:5000/ (adjust for production)
- Endpoints used:
  - POST /auth/register (multipart/form-data) - register with profile image
  - POST /auth/login (application/json) - obtain access and refresh tokens plus session_id
  - POST /auth/refresh (application/json) - rotate refresh token, returns new tokens plus session_id
  - POST /auth/revoke (application/json) - revoke session by session_id or refresh_token (requires Bearer access token)
  - GET /auth/sessions (requires Bearer) - list user's sessions

Registration requirements

- Required form fields: name, email, password, age, gender, height, weight, activityLevel, dietaryPreference.
- Optional file field: profileImage (multipart file)
- Image validation (server-side): allowed MIME types image/jpeg, image/png, image/webp; max size 5 MB.

Recommended Flutter deps

- http
- flutter_secure_storage

Quick examples

1. Register (multipart with optional image)

Dart (using http):

import 'dart:io';
import 'package:http/http.dart' as http;

Future<http.Response> register({
required String name,
required String email,
required String password,
required String age,
required String gender,
required String height,
required String weight,
required String activityLevel,
required String dietaryPreference,
File? profileImage,
}) async {
final uri = Uri.parse('http://localhost:5000/auth/register');
final request = http.MultipartRequest('POST', uri);
request.fields['name'] = name;
request.fields['email'] = email;
request.fields['password'] = password;
request.fields['age'] = age;
request.fields['gender'] = gender;
request.fields['height'] = height;
request.fields['weight'] = weight;
request.fields['activityLevel'] = activityLevel;
request.fields['dietaryPreference'] = dietaryPreference;

if (profileImage != null) {
final stream = http.ByteStream(profileImage.openRead());
final length = await profileImage.length();
final multipartFile = http.MultipartFile(
'profileImage',
stream,
length,
filename: profileImage.path.split('\\').last,
);
request.files.add(multipartFile);
}

final streamed = await request.send();
return http.Response.fromStream(streamed);
}

2. Login

POST /auth/login
Body (JSON): { "email": "...", "password": "...", "device_id": "optional-device-id" }

Response (success): {
accessToken,
access_expires_in,
refresh_token,
refresh_expires_in,
session_id,
user
}

Dart example (store tokens):

import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

final storage = FlutterSecureStorage();

Future<void> login(String email, String password) async {
final res = await http.post(
Uri.parse('http://localhost:5000/auth/login'),
headers: {'Content-Type': 'application/json'},
body: jsonEncode({'email': email, 'password': password}),
);
final data = jsonDecode(res.body)['data'];
await storage.write(key: 'access_token', value: data['accessToken']);
await storage.write(key: 'refresh_token', value: data['refresh_token']);
await storage.write(key: 'session_id', value: data['session_id']);
}

3. Refresh (auto-login / token rotation)

Use stored refresh_token to call /auth/refresh. Server rotates the refresh token and returns new tokens and session.

Future<void> refreshTokens() async {
final refresh = await storage.read(key: 'refresh_token');
if (refresh == null) return;

final res = await http.post(
Uri.parse('http://localhost:5000/auth/refresh'),
headers: {'Content-Type': 'application/json'},
body: jsonEncode({'refresh_token': refresh}),
);

if (res.statusCode == 201) {
final data = jsonDecode(res.body)['data'];
await storage.write(key: 'access_token', value: data['accessToken']);
await storage.write(key: 'refresh_token', value: data['refresh_token']);
await storage.write(key: 'session_id', value: data['session_id']);
} else {
await storage.deleteAll();
}
}

4. Revoke session (logout device)

- Preferred: call POST /auth/revoke with { "session_id": "..." } while supplying Authorization: Bearer <accessToken> header.
- Alternatively supply { "refresh_token": "..." }.

Example:

final token = await storage.read(key: 'access_token');
await http.post(
Uri.parse('http://localhost:5000/auth/revoke'),
headers: {
'Content-Type': 'application/json',
'Authorization': 'Bearer $token',
},
body: jsonEncode({'session_id': await storage.read(key: 'session_id')}),
);

5. Sessions list

GET /auth/sessions (requires Bearer) - returns sessions with revoked, issuedAt, expiresAt, deviceId, deviceInfo.

Implementation notes / best practices

- Store tokens in flutter_secure_storage (access token short-lived; refresh token long-lived). Do not store in plaintext storage.
- On app start: try refreshTokens() to silently restore session. If refresh fails, show login screen.
- Include device_id (UUID per device) on login to enable per-device session management.
- Handle server responses: 401 invalid token, 403 revoked, 429 rate-limited gracefully.
- Validate selected image client-side before upload (MIME and size) to avoid wasted uploads.

Server constraints to mirror on client

- Allowed image types: JPEG, PNG, WebP.
- Max upload size: 5 MB.
- Required profile fields: age, gender, height, weight, activityLevel, dietaryPreference (send them during registration).

Curl quick reference

Register (without file):

curl -X POST "http://localhost:5000/auth/register" \
 -F "name=Test" \
 -F "email=test@example.com" \
 -F "password=Password123!" \
 -F "age=30" \
 -F "gender=male" \
 -F "height=180" \
 -F "weight=75" \
 -F "activityLevel=moderate" \
 -F "dietaryPreference=omnivore"

Login:

curl -X POST "http://localhost:5000/auth/login" -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"Password123!"}'

Refresh:

curl -X POST "http://localhost:5000/auth/refresh" -H "Content-Type: application/json" -d '{"refresh_token":"<TOKEN>"}'

Revoke:

curl -X POST "http://localhost:5000/auth/revoke" -H "Content-Type: application/json" -H "Authorization: Bearer <ACCESS_TOKEN>" -d '{"session_id":"<SESSION_ID>"}'

If you'd like, I can produce a ready-to-copy Flutter service class (Dart) that implements register, login, refresh, revoke, and secure storage with retry logic. Tell me if you want that class and whether to include device-id generation logic.
