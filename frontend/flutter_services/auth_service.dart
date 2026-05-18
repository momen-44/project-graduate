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
  if (!await file.exists()) {
    throw ApiException(
      message: 'Selected image file does not exist.',
      statusCode: 400,
    );
  }

  final token = await _readAccessToken();
  if (token == null || token.isEmpty) {
    throw ApiException(
      message: 'Unauthorized - Access token is missing',
      statusCode: 401,
    );
  }

  Future<Map<String, dynamic>> sendWithToken(
    String token,
    String endpoint,
    String fieldName,
  ) async {
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl$endpoint'),
    );
    request.headers['Authorization'] = 'Bearer $token';
    request.headers['Accept'] = 'application/json';

    if (mealType != null && mealType.trim().isNotEmpty) {
      request.fields['mealType'] = mealType.trim();
    }
    if (userContext != null && userContext.trim().isNotEmpty) {
      request.fields['userContext'] = userContext.trim();
    }

    request.files.add(
      await http.MultipartFile.fromPath(fieldName, cleanPath),
    );

    final response = await _requestWithHandling(() async {
      final streamed = await request.send();
      return http.Response.fromStream(streamed);
    });

    return _handleResponse(response);
  }

  final endpoints = ['/food/image', '/foods/image', '/ai/image-analysis'];
  final fieldNames = ['file', 'image', 'photo'];
  ApiException? lastException;

  for (final endpoint in endpoints) {
    for (final fieldName in fieldNames) {
      try {
        return sendWithToken(token, endpoint, fieldName);
      } on ApiException catch (e) {
        lastException = e;
        if (e.statusCode == 404) continue;
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