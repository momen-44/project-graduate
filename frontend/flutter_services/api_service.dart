import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class ApiService {
  static final String baseUrl = _resolveBaseUrl();
  static const Duration requestTimeout = Duration(seconds: 12);

  static const FlutterSecureStorage _secureStorage = FlutterSecureStorage();

  static const String _accessTokenKey = 'nl_access_token';
  static const String _refreshTokenKey = 'nl_refresh_token';
  static const String _sessionIdKey = 'nl_session_id';
  static const String _deviceIdKey = 'nl_device_id';

  static const String _legacyAccessTokenKey = 'access_token';
  static const String _legacyRefreshTokenKey = 'refresh_token';
  static const String _legacySessionIdKey = 'session_id';
  static const String _legacyDeviceIdKey = 'device_id';

  static final ApiService _instance = ApiService._internal();
  static final ValueNotifier<int> foodHistoryVersion = ValueNotifier<int>(0);

  factory ApiService() => _instance;

  ApiService._internal();

  static String _normalizeBaseUrl(String url) {
    return url.trim().replaceAll(RegExp(r'/+$'), '');
  }

  static String _resolveBaseUrl() {
    const envBaseUrl = String.fromEnvironment('API_BASE_URL');
    if (envBaseUrl.isNotEmpty) {
      return _normalizeBaseUrl(envBaseUrl);
    }

    if (!kIsWeb && Platform.isAndroid) {
      return 'http://10.0.2.2:4000';
    }

    return 'http://localhost:4000';
  }

  Future<Map<String, dynamic>> register({
    required String name,
    required String email,
    required String password,
    int? age,
    String? gender,
    int? height,
    int? weight,
    String? activityLevel,
    String? metabolismRate,
    String? dietaryPreference,
    String? profileImageUrl,
    String? profileImagePublicId,
    String? profileImagePath,
  }) async {
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/auth/register'),
    );

    final requiredFields = <String, String>{
      'name': name.trim(),
      'email': email.trim(),
      'password': password,
      'age': age?.toString() ?? '',
      'gender': gender?.trim() ?? '',
      'height': height?.toString() ?? '',
      'weight': weight?.toString() ?? '',
      'activityLevel': activityLevel?.trim() ?? '',
      'dietaryPreference': dietaryPreference?.trim() ?? '',
    };

    for (final entry in requiredFields.entries) {
      if (entry.value.trim().isEmpty) {
        throw ApiException(
          message: 'The ${entry.key} field is required.',
          statusCode: 400,
        );
      }
    }

    request.fields.addAll(requiredFields);

    if (metabolismRate != null && metabolismRate.trim().isNotEmpty) {
      request.fields['metabolismRate'] = metabolismRate.trim();
    }

    if (profileImageUrl != null && profileImageUrl.trim().isNotEmpty) {
      request.fields['profileImageUrl'] = profileImageUrl.trim();
    }

    if (profileImagePublicId != null &&
        profileImagePublicId.trim().isNotEmpty) {
      request.fields['profileImagePublicId'] = profileImagePublicId.trim();
    }

    if (profileImagePath != null && profileImagePath.trim().isNotEmpty) {
      final imageFile = File(profileImagePath.trim());
      await _validateProfileImageFile(imageFile);
      request.files.add(
        await http.MultipartFile.fromPath('profileImage', imageFile.path),
      );
    }

    final streamedResponse = await _requestWithHandling(() async {
      final streamed = await request.send();
      return http.Response.fromStream(streamed);
    });

    final result = _handleResponse(streamedResponse);
    await _saveSessionFromAuthResult(result);
    return result;
  }

  Future<Map<String, dynamic>> registerWithImage({
    required String name,
    required String email,
    required String password,
    int? age,
    String? gender,
    int? height,
    int? weight,
    String? activityLevel,
    String? metabolismRate,
    String? dietaryPreference,
    String? profileImagePath,
  }) {
    return register(
      name: name,
      email: email,
      password: password,
      age: age,
      gender: gender,
      height: height,
      weight: weight,
      activityLevel: activityLevel,
      metabolismRate: metabolismRate,
      dietaryPreference: dietaryPreference,
      profileImagePath: profileImagePath,
    );
  }

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
    String? deviceId,
  }) async {
    final resolvedDeviceId = deviceId ?? await _resolveDeviceId();

    final response = await _requestWithHandling(() {
      return http.post(
        Uri.parse('$baseUrl/auth/login'),
        headers: _headers(),
        body: jsonEncode({
          'email': email,
          'password': password,
          'device_id': resolvedDeviceId,
        }),
      );
    });

    final result = _handleResponse(response);
    await _saveSessionFromAuthResult(result);
    return result;
  }

  Future<bool> tryAutoLogin() async {
    final token = await _readRefreshToken();
    if (token == null || token.isEmpty) {
      return false;
    }

    try {
      await refreshSession(refreshToken: token);
      return true;
    } catch (_) {
      await clearSession();
      return false;
    }
  }

  Future<Map<String, dynamic>> refreshSession({String? refreshToken}) async {
    final token = refreshToken ?? await _readRefreshToken();
    if (token == null || token.isEmpty) {
      throw ApiException(
        message: 'Refresh token is required.',
        statusCode: 400,
      );
    }

    final storedDeviceId = await _readDeviceId();

    final response = await _requestWithHandling(() {
      return http.post(
        Uri.parse('$baseUrl/auth/refresh'),
        headers: _headers(),
        body: jsonEncode({
          'refresh_token': token,
          if (storedDeviceId != null && storedDeviceId.isNotEmpty)
            'device_id': storedDeviceId,
        }),
      );
    });

    final result = _handleResponse(response);
    await _saveSessionFromAuthResult(result);
    return result;
  }

  Future<Map<String, dynamic>> getSessions() {
    return _executeAuthenticated((token) {
      return http.get(
        Uri.parse('$baseUrl/auth/sessions'),
        headers: _authHeaders(token),
      );
    });
  }

  Future<Map<String, dynamic>> forgotPassword({required String email}) async {
    final response = await _requestWithHandling(() {
      return http.post(
        Uri.parse('$baseUrl/auth/forgot-password'),
        headers: _headers(),
        body: jsonEncode({'email': email}),
      );
    });

    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> resetPassword({
    required String email,
    required String token,
    required String newPassword,
  }) async {
    final response = await _requestWithHandling(() {
      return http.post(
        Uri.parse('$baseUrl/auth/reset-password'),
        headers: _headers(),
        body: jsonEncode({
          'email': email,
          'token': token,
          'newPassword': newPassword,
        }),
      );
    });

    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> analyzeText({
    required String mealType,
    required String description,
    String? userContext,
  }) {
    final cleanDescription = description.trim();
    if (cleanDescription.isEmpty) {
      throw ApiException(message: 'Description is required.', statusCode: 400);
    }

    return _executeAuthenticated((token) {
      return http.post(
        Uri.parse('$baseUrl/food/text'),
        headers: _authHeaders(token),
        body: jsonEncode({
          'mealType': mealType,
          'description': cleanDescription,
          if (userContext != null && userContext.trim().isNotEmpty)
            'userContext': userContext.trim(),
        }),
      );
    });
  }

  Future<Map<String, dynamic>> analyzeImage({
    required String imagePath,
    String? mealType,
    String? userContext,
  }) async {
    final cleanPath = imagePath.trim();
    if (cleanPath.isEmpty) {
      throw ApiException(message: 'Image path is required.', statusCode: 400);
    }

    final file = File(cleanPath);
    if (!file.existsSync()) {
      throw ApiException(
        message: 'Selected image file does not exist.',
        statusCode: 400,
      );
    }

    const endpointCandidates = [
      '/food/image',
      '/foods/image',
      '/ai/image-analysis',
    ];
    const fileFieldCandidates = ['file', 'image', 'photo'];

    Future<http.Response> sendRequest(
      String token,
      String endpointPath,
      String fileField,
    ) async {
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl$endpointPath'),
      );
      request.headers['Authorization'] = 'Bearer $token';
      request.headers['Accept'] = 'application/json';

      if (mealType != null && mealType.trim().isNotEmpty) {
        request.fields['mealType'] = mealType.trim();
      }
      if (userContext != null && userContext.trim().isNotEmpty) {
        request.fields['userContext'] = userContext.trim();
      }

      request.files.add(await http.MultipartFile.fromPath(fileField, cleanPath));

      return _requestWithHandling(() async {
        final streamed = await request.send();
        return http.Response.fromStream(streamed);
      });
    }

    Future<Map<String, dynamic>> tryAllCandidates(String token) async {
      ApiException? lastException;

      for (var endpointIndex = 0;
          endpointIndex < endpointCandidates.length;
          endpointIndex++) {
        final endpointPath = endpointCandidates[endpointIndex];

        for (var fieldIndex = 0;
            fieldIndex < fileFieldCandidates.length;
            fieldIndex++) {
          final fileField = fileFieldCandidates[fieldIndex];
          final isLastAttempt = endpointIndex == endpointCandidates.length - 1 &&
              fieldIndex == fileFieldCandidates.length - 1;

          final response = await sendRequest(token, endpointPath, fileField);

          if (response.statusCode == 404 && !isLastAttempt) {
            continue;
          }

          try {
            return _handleResponse(response);
          } on ApiException catch (e) {
            lastException = e;
            if ((e.statusCode == 404 || e.statusCode == 400) && !isLastAttempt) {
              continue;
            }
            rethrow;
          }
        }
      }

      throw lastException ??
          ApiException(
            message: 'Unable to resolve a valid image analysis endpoint.',
            statusCode: 404,
          );
    }

    final token = await _readAccessToken();
    if (token == null || token.isEmpty) {
      throw ApiException(
        message: 'Unauthorized - Access token is missing',
        statusCode: 401,
      );
    }

    var accessToken = token;
    try {
      return await tryAllCandidates(accessToken);
    } on ApiException catch (e) {
      if (!e.isUnauthorized) rethrow;
      accessToken = await _refreshAccessToken();
      return tryAllCandidates(accessToken);
    }
  }

  Future<Map<String, dynamic>> getFoods({
    int page = 1,
    int limit = 50,
    String? search,
  }) async {
    if (page < 1) {
      throw ApiException(message: 'Page must be at least 1.', statusCode: 400);
    }
    if (limit < 1) {
      throw ApiException(message: 'Limit must be at least 1.', statusCode: 400);
    }

    final history = await getFoodHistory();
    final items = _extractHistoryItems(history);
    final searchTerm = search?.trim().toLowerCase();

    final filtered = searchTerm == null || searchTerm.isEmpty
        ? items
        : items.where((item) {
            final blob = _toSearchableText(item);
            return blob.contains(searchTerm);
          }).toList();

    final start = (page - 1) * limit;
    final end = min(start + limit, filtered.length);

    final pagedItems = start >= filtered.length
        ? <Map<String, dynamic>>[]
        : filtered.sublist(start, end);

    return {
      'success': true,
      'data': {
        'items': pagedItems,
        'total': filtered.length,
        'page': page,
        'limit': limit,
      },
    };
  }

  Future<Map<String, dynamic>> getFoodById(String foodId) async {
    final id = foodId.trim();
    if (id.isEmpty) {
      throw ApiException(message: 'Food id is required.', statusCode: 400);
    }

    final history = await getFoodHistory();
    final items = _extractHistoryItems(history);

    final match = items.where((item) => item['id']?.toString() == id).toList();

    if (match.isEmpty) {
      throw ApiException(message: 'Food item not found.', statusCode: 404);
    }

    return {
      'success': true,
      'data': match.first,
    };
  }

  Future<Map<String, dynamic>> getDailyCalories() {
    return _executeAuthenticated((token) {
      return http.get(
        Uri.parse('$baseUrl/daily-calories'),
        headers: _authHeaders(token),
      );
    });
  }

  Future<Map<String, dynamic>> getCurrentUser() {
    return _executeAuthenticated((token) {
      return http.get(
        Uri.parse('$baseUrl/users/me'),
        headers: _authHeaders(token),
      );
    });
  }

  Future<Map<String, dynamic>> updateCurrentUser({
    String? name,
    int? age,
    String? gender,
    int? height,
    int? weight,
    String? activityLevel,
    String? metabolismRate,
    String? dietaryPreference,
    String? profileImageUrl,
    String? profileImagePublicId,
  }) {
    final payload = <String, dynamic>{
      if (name != null) 'name': name,
      if (age != null) 'age': age,
      if (gender != null) 'gender': gender,
      if (height != null) 'height': height,
      if (weight != null) 'weight': weight,
      if (activityLevel != null) 'activityLevel': activityLevel,
      if (metabolismRate != null) 'metabolismRate': metabolismRate,
      if (dietaryPreference != null) 'dietaryPreference': dietaryPreference,
      if (profileImageUrl != null) 'profileImageUrl': profileImageUrl,
      if (profileImagePublicId != null)
        'profileImagePublicId': profileImagePublicId,
    };

    if (payload.isEmpty) {
      throw ApiException(
        message: 'Please provide at least one field to update.',
        statusCode: 400,
      );
    }

    return _executeAuthenticated((token) {
      return http.put(
        Uri.parse('$baseUrl/users/update'),
        headers: _authHeaders(token),
        body: jsonEncode(payload),
      );
    });
  }

  Future<Map<String, dynamic>> uploadCurrentUserProfilePhoto({
    required String imagePath,
  }) async {
    final cleanPath = imagePath.trim();
    if (cleanPath.isEmpty) {
      throw ApiException(
        message: 'Profile image path is required.',
        statusCode: 400,
      );
    }

    final file = File(cleanPath);
    if (!file.existsSync()) {
      throw ApiException(
        message: 'Selected profile image file does not exist.',
        statusCode: 400,
      );
    }

    throw ApiException(
      message:
          'Direct profile image upload endpoint is not available in this backend. Upload to Cloudinary first, then call updateCurrentUser(profileImageUrl, profileImagePublicId).',
      statusCode: 501,
    );
  }

  Future<Map<String, dynamic>> deleteAccountById(String userId) {
    final id = userId.trim();
    if (id.isEmpty) {
      throw ApiException(message: 'User id is required.', statusCode: 400);
    }

    return _executeAuthenticatedDeleteWithFallback([
      Uri.parse('$baseUrl/users/$id'),
    ]);
  }

  Future<Map<String, dynamic>> getFoodHistory() {
    return _executeAuthenticatedGetWithFallback([
      Uri.parse('$baseUrl/food/history'),
      Uri.parse('$baseUrl/foods/history'),
    ]);
  }

  Future<Map<String, dynamic>> deleteFoodHistoryItem(String historyId) {
    final id = historyId.trim();
    if (id.isEmpty) {
      throw ApiException(
        message: 'History item id is required.',
        statusCode: 400,
      );
    }

    return _executeAuthenticatedDeleteWithFallback([
      Uri.parse('$baseUrl/food/history/$id'),
      Uri.parse('$baseUrl/foods/history/$id'),
      Uri.parse('$baseUrl/food/$id'),
      Uri.parse('$baseUrl/foods/$id'),
      Uri.parse('$baseUrl/ai/suggest/$id'),
      Uri.parse('$baseUrl/food/history').replace(queryParameters: {'id': id}),
      Uri.parse('$baseUrl/food/history')
          .replace(queryParameters: {'historyId': id}),
    ]).then((result) {
      foodHistoryVersion.value = foodHistoryVersion.value + 1;
      return result;
    });
  }

  Future<void> logout() async {
    try {
      final sessionId = await _readSessionId();
      final refreshToken = await _readRefreshToken();

      await _executeAuthenticated((token) {
        final payload = <String, dynamic>{
          if (sessionId != null && sessionId.isNotEmpty) 'session_id': sessionId,
          if ((sessionId == null || sessionId.isEmpty) &&
              refreshToken != null &&
              refreshToken.isNotEmpty)
            'refresh_token': refreshToken,
        };

        return http.post(
          Uri.parse('$baseUrl/auth/revoke'),
          headers: _authHeaders(token),
          body: jsonEncode(payload),
        );
      });
    } catch (_) {
      // Clear local session even when network call fails.
    } finally {
      await clearSession();
    }
  }

  Future<bool> isLoggedIn() async {
    final token = await _readAccessToken();
    return token != null && token.isNotEmpty;
  }

  Future<void> clearSession() async {
    await _deleteSecureValue(_accessTokenKey, _legacyAccessTokenKey);
    await _deleteSecureValue(_refreshTokenKey, _legacyRefreshTokenKey);
    await _deleteSecureValue(_sessionIdKey, _legacySessionIdKey);
  }

  Future<String?> getAccessToken() => _readAccessToken();

  Future<String?> getRefreshToken() => _readRefreshToken();

  Future<String?> getSessionId() => _readSessionId();

  Future<Map<String, dynamic>> _executeAuthenticated(
    Future<http.Response> Function(String token) request,
  ) async {
    final token = await _readAccessToken();
    if (token == null || token.isEmpty) {
      throw ApiException(
        message: 'Unauthorized - Access token is missing',
        statusCode: 401,
      );
    }

    var accessToken = token;

    try {
      final response = await _requestWithHandling(() => request(accessToken));
      return _handleResponse(response);
    } on ApiException catch (e) {
      if (!e.isUnauthorized) rethrow;
      accessToken = await _refreshAccessToken();
      final retryResponse = await _requestWithHandling(
        () => request(accessToken),
      );
      return _handleResponse(retryResponse);
    }
  }

  Future<Map<String, dynamic>> _executeAuthenticatedGetWithFallback(
    List<Uri> candidates,
  ) async {
    final token = await _readAccessToken();
    if (token == null || token.isEmpty) {
      throw ApiException(
        message: 'Unauthorized - Access token is missing',
        statusCode: 401,
      );
    }

    var accessToken = token;

    try {
      return _performGetWithFallback(accessToken, candidates);
    } on ApiException catch (e) {
      if (!e.isUnauthorized) rethrow;
      accessToken = await _refreshAccessToken();
      return _performGetWithFallback(accessToken, candidates);
    }
  }

  Future<Map<String, dynamic>> _executeAuthenticatedDeleteWithFallback(
    List<Uri> candidates,
  ) async {
    final token = await _readAccessToken();
    if (token == null || token.isEmpty) {
      throw ApiException(
        message: 'Unauthorized - Access token is missing',
        statusCode: 401,
      );
    }

    var accessToken = token;

    try {
      return _performDeleteWithFallback(accessToken, candidates);
    } on ApiException catch (e) {
      if (!e.isUnauthorized) rethrow;
      accessToken = await _refreshAccessToken();
      return _performDeleteWithFallback(accessToken, candidates);
    }
  }

  Future<Map<String, dynamic>> _performGetWithFallback(
    String token,
    List<Uri> candidates,
  ) async {
    if (candidates.isEmpty) {
      throw ApiException(
        message: 'No endpoint candidates provided.',
        statusCode: 500,
      );
    }

    ApiException? lastException;

    for (var i = 0; i < candidates.length; i++) {
      final isLast = i == candidates.length - 1;
      final response = await _requestWithHandling(
        () => http.get(candidates[i], headers: _authHeaders(token)),
      );

      if (response.statusCode == 404 && !isLast) {
        continue;
      }

      try {
        return _handleResponse(response);
      } on ApiException catch (e) {
        lastException = e;
        if (e.statusCode == 404 && !isLast) {
          continue;
        }
        rethrow;
      }
    }

    throw lastException ??
        ApiException(
          message: 'Unable to resolve a valid endpoint.',
          statusCode: 404,
        );
  }

  Future<Map<String, dynamic>> _performDeleteWithFallback(
    String token,
    List<Uri> candidates,
  ) async {
    if (candidates.isEmpty) {
      throw ApiException(
        message: 'No endpoint candidates provided.',
        statusCode: 500,
      );
    }

    ApiException? lastException;

    for (var i = 0; i < candidates.length; i++) {
      final isLast = i == candidates.length - 1;
      final response = await _requestWithHandling(
        () => http.delete(candidates[i], headers: _authHeaders(token)),
      );

      if (response.statusCode == 404 && !isLast) {
        continue;
      }

      try {
        return _handleDeleteResponse(response);
      } on ApiException catch (e) {
        lastException = e;
        if (e.statusCode == 404 && !isLast) {
          continue;
        }
        rethrow;
      }
    }

    throw lastException ??
        ApiException(
          message: 'Unable to resolve a valid endpoint.',
          statusCode: 404,
        );
  }

  Map<String, dynamic> _handleDeleteResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.statusCode == 204 || response.body.trim().isEmpty) {
        return {
          'success': true,
          'message': 'Delete operation completed successfully.',
          'data': {'deleted': true},
        };
      }
    }

    return _handleResponse(response);
  }

  Future<String> _refreshAccessToken() async {
    final result = await refreshSession();
    final data = _extractDataMap(result);
    final accessToken = _readTokenValue(data, ['accessToken', 'access_token']);

    if (accessToken == null || accessToken.isEmpty) {
      await clearSession();
      throw ApiException(
        message: 'Unauthorized - Invalid refresh response',
        statusCode: 401,
      );
    }

    return accessToken;
  }

  Future<void> _saveSessionFromAuthResult(Map<String, dynamic> result) async {
    final data = _extractDataMap(result);
    final accessToken = _readTokenValue(data, ['accessToken', 'access_token']);
    final refreshToken = _readTokenValue(data, ['refreshToken', 'refresh_token']);
    final sessionId = _readTokenValue(data, ['sessionId', 'session_id']);

    if (accessToken != null && accessToken.isNotEmpty) {
      await _writeSecureValue(
        _accessTokenKey,
        _legacyAccessTokenKey,
        accessToken,
      );
    }

    if (refreshToken != null && refreshToken.isNotEmpty) {
      await _writeSecureValue(
        _refreshTokenKey,
        _legacyRefreshTokenKey,
        refreshToken,
      );
    }

    if (sessionId != null && sessionId.isNotEmpty) {
      await _writeSecureValue(_sessionIdKey, _legacySessionIdKey, sessionId);
    }
  }

  Future<void> _validateProfileImageFile(File file) async {
    if (!await file.exists()) {
      throw ApiException(
        message: 'Selected image file does not exist.',
        statusCode: 400,
      );
    }

    const allowedExtensions = {'.jpg', '.jpeg', '.png', '.webp'};
    final dotIndex = file.path.lastIndexOf('.');
    final extension =
        dotIndex == -1 ? '' : file.path.toLowerCase().substring(dotIndex);

    if (!allowedExtensions.contains(extension)) {
      throw ApiException(
        message: 'Profile image must be a JPEG, PNG, or WebP file.',
        statusCode: 400,
      );
    }

    const maxSizeBytes = 5 * 1024 * 1024;
    final fileSize = await file.length();
    if (fileSize > maxSizeBytes) {
      throw ApiException(
        message: 'Profile image must be 5 MB or smaller.',
        statusCode: 400,
      );
    }
  }

  Future<String> _resolveDeviceId() async {
    final storedDeviceId = await _readDeviceId();
    if (storedDeviceId != null && storedDeviceId.isNotEmpty) {
      return storedDeviceId;
    }

    final generated =
        'nl-${DateTime.now().microsecondsSinceEpoch}-${Random().nextInt(1 << 32).toRadixString(16)}';

    await _writeSecureValue(_deviceIdKey, _legacyDeviceIdKey, generated);
    return generated;
  }

  String? _readTokenValue(Map<String, dynamic>? data, List<String> keys) {
    if (data == null) return null;

    for (final key in keys) {
      final value = data[key]?.toString();
      if (value != null && value.isNotEmpty) {
        return value;
      }
    }

    return null;
  }

  Future<http.Response> _requestWithHandling(
    Future<http.Response> Function() request,
  ) async {
    try {
      return await request().timeout(requestTimeout);
    } on TimeoutException {
      throw ApiException(
        message: 'The request timed out. Please try again in a moment.',
        statusCode: 408,
      );
    } on SocketException {
      throw ApiException(
        message:
            'Could not reach the server. Please check your internet connection and try again.',
        statusCode: 0,
      );
    } on http.ClientException catch (e) {
      throw ApiException(
        message: e.message.isNotEmpty
            ? 'Network request failed: ${e.message}'
            : 'Network request failed.',
        statusCode: 0,
      );
    }
  }

  Map<String, dynamic> _handleResponse(http.Response response) {
    if (response.body.trim().isEmpty) {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return {
          'success': true,
          'data': null,
        };
      }

      throw ApiException(
        message: _fallbackMessageForStatus(response.statusCode),
        statusCode: response.statusCode,
      );
    }

    Map<String, dynamic> jsonResponse;
    try {
      jsonResponse = jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      throw ApiException(
        message: 'Failed to parse response',
        statusCode: response.statusCode,
        response: {'body': response.body},
      );
    }

    final fallbackMessage = _fallbackMessageForStatus(response.statusCode);
    final extractedMessage = _extractMessage(jsonResponse);
    final effectiveMessage =
        extractedMessage == 'Request failed' ? fallbackMessage : extractedMessage;

    if (response.statusCode == 401) {
      throw ApiException(
        message: effectiveMessage,
        statusCode: 401,
        response: jsonResponse,
      );
    }

    if (response.statusCode == 429) {
      throw ApiException(
        message: effectiveMessage,
        statusCode: 429,
        response: jsonResponse,
      );
    }

    if (response.statusCode == 400) {
      throw ApiException(
        message: effectiveMessage,
        statusCode: 400,
        response: jsonResponse,
      );
    }

    if (jsonResponse['success'] != true) {
      throw ApiException(
        message: effectiveMessage,
        statusCode: response.statusCode,
        response: jsonResponse,
      );
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        message: effectiveMessage,
        statusCode: response.statusCode,
        response: jsonResponse,
      );
    }

    return jsonResponse;
  }

  String _extractMessage(Map<String, dynamic> jsonResponse) {
    final error = jsonResponse['error'];
    if (error is String && error.isNotEmpty) {
      return error;
    }

    if (error is Map<String, dynamic>) {
      final message = error['message']?.toString();
      if (message != null && message.isNotEmpty) {
        return message;
      }
    }

    final errors = jsonResponse['errors'];
    if (errors is List && errors.isNotEmpty) {
      final first = errors.first;
      if (first is String && first.isNotEmpty) {
        return first;
      }
      if (first is Map<String, dynamic>) {
        final message = first['message']?.toString();
        if (message != null && message.isNotEmpty) {
          return message;
        }
      }
    }

    final data = jsonResponse['data'];
    if (data is Map<String, dynamic>) {
      final dataMessage = data['message']?.toString();
      if (dataMessage != null && dataMessage.isNotEmpty) {
        return dataMessage;
      }
    }

    final message = jsonResponse['message']?.toString();
    if (message != null && message.isNotEmpty) {
      return message;
    }

    return 'Request failed';
  }

  String _fallbackMessageForStatus(int statusCode) {
    if (statusCode == 400) {
      return 'Invalid request data. Please review your input and try again.';
    }
    if (statusCode == 401) {
      return 'Unauthorized request. Please sign in again.';
    }
    if (statusCode == 404) {
      return 'Requested endpoint was not found.';
    }
    if (statusCode == 429) {
      return 'Too many requests. Please wait and try again.';
    }
    if (statusCode >= 500) {
      return 'Server error. Please try again later.';
    }

    return 'Request failed';
  }

  Map<String, dynamic>? _extractDataMap(Map<String, dynamic>? payload) {
    if (payload == null) return null;

    final nested = payload['data'];
    if (nested is Map<String, dynamic>) {
      return nested;
    }

    return payload;
  }

  List<Map<String, dynamic>> _extractHistoryItems(Map<String, dynamic> response) {
    final data = response['data'];
    if (data is! List) {
      return const [];
    }

    return data
        .whereType<Map>()
        .map((item) => item.map(
              (key, value) => MapEntry(key.toString(), value),
            ))
        .toList();
  }

  String _toSearchableText(Map<String, dynamic> payload) {
    try {
      return jsonEncode(payload).toLowerCase();
    } catch (_) {
      return payload.toString().toLowerCase();
    }
  }

  Map<String, String> _headers() {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  Map<String, String> _authHeaders(String token) {
    final headers = _headers();
    headers['Authorization'] = 'Bearer $token';
    return headers;
  }

  Future<String?> _readAccessToken() {
    return _readSecureValue(_accessTokenKey, _legacyAccessTokenKey);
  }

  Future<String?> _readRefreshToken() {
    return _readSecureValue(_refreshTokenKey, _legacyRefreshTokenKey);
  }

  Future<String?> _readSessionId() {
    return _readSecureValue(_sessionIdKey, _legacySessionIdKey);
  }

  Future<String?> _readDeviceId() {
    return _readSecureValue(_deviceIdKey, _legacyDeviceIdKey);
  }

  Future<String?> _readSecureValue(String key, String legacyKey) async {
    final current = await _secureStorage.read(key: key);
    if (current != null && current.isNotEmpty) {
      return current;
    }

    final legacy = await _secureStorage.read(key: legacyKey);
    if (legacy != null && legacy.isNotEmpty) {
      await _secureStorage.write(key: key, value: legacy);
      return legacy;
    }

    return null;
  }

  Future<void> _writeSecureValue(
    String key,
    String legacyKey,
    String value,
  ) async {
    await _secureStorage.write(key: key, value: value);
    await _secureStorage.write(key: legacyKey, value: value);
  }

  Future<void> _deleteSecureValue(String key, String legacyKey) async {
    await _secureStorage.delete(key: key);
    await _secureStorage.delete(key: legacyKey);
  }

  @visibleForTesting
  Map<String, dynamic> debugHandleResponse(http.Response response) {
    return _handleResponse(response);
  }

  @visibleForTesting
  String debugExtractMessage(Map<String, dynamic> jsonResponse) {
    return _extractMessage(jsonResponse);
  }
}

class ApiException implements Exception {
  final String message;
  final int statusCode;
  final Map<String, dynamic>? response;

  ApiException({
    required this.message,
    required this.statusCode,
    this.response,
  });

  bool get isUnauthorized => statusCode == 401;

  @override
  String toString() => 'ApiException: $message (Status: $statusCode)';
}
