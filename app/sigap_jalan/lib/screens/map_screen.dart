import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:async';
import 'dart:math' as math;
import '../routing/graph.dart';

/// Represents a geocoded place from the Photon API
class PhotonPlace {
  final double lat;
  final double lon;
  final String name;

  const PhotonPlace({
    required this.lat,
    required this.lon,
    required this.name,
  });
}

class OSRMRouteOption {
  final int index;
  final double distance;
  final double duration;
  final List<LatLng> geometry;
  final List<dynamic> potholes;
  final int avoidedCount;

  OSRMRouteOption({
    required this.index,
    required this.distance,
    required this.duration,
    required this.geometry,
    required this.potholes,
    required this.avoidedCount,
  });
}

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final RoadGraph _graph = RoadGraph();
  final MapController _mapController = MapController();

  bool _preferSmoothRoute = true;

  DijkstraResult? _shortestResult;
  DijkstraResult? _smoothestResult;

  LatLng? _deviceLocation;
  bool _isLocating = false;
  String? _debugError;

  final String _baseUrl = 'http://127.0.0.1:8080';
  List<OSRMRouteOption> _osrmRoutes = [];
  int _selectedRouteIndex = 0;
  List<dynamic> _dbPotholes = [];
  bool _isLoadingRoute = false;

  // ── Photon geocoding autocomplete state ────────────────────────────────────
  final TextEditingController _startController = TextEditingController();
  final TextEditingController _endController = TextEditingController();
  final FocusNode _startFocus = FocusNode();
  final FocusNode _endFocus = FocusNode();

  PhotonPlace? _startPlace;
  PhotonPlace? _endPlace;

  List<PhotonPlace> _startSuggestions = [];
  List<PhotonPlace> _endSuggestions = [];

  bool _showStartSuggestions = false;
  bool _showEndSuggestions = false;

  bool _isSearchingStart = false;
  bool _isSearchingEnd = false;

  Timer? _startDebounce;
  Timer? _endDebounce;

  @override
  void initState() {
    super.initState();
    _initData();

    // Start fields as empty
    _startController.text = '';
    _endController.text = '';

    _startPlace = null;
    _endPlace = null;

    _startFocus.addListener(() {
      if (!_startFocus.hasFocus) {
        Future.delayed(const Duration(milliseconds: 200), () {
          if (mounted) setState(() => _showStartSuggestions = false);
        });
      }
    });
    _endFocus.addListener(() {
      if (!_endFocus.hasFocus) {
        Future.delayed(const Duration(milliseconds: 200), () {
          if (mounted) setState(() => _showEndSuggestions = false);
        });
      }
    });

    // Automatically fetch current GPS location on startup as default starting point
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _useDeviceLocation();
    });

  }

  @override
  void dispose() {
    _startController.dispose();
    _endController.dispose();
    _startFocus.dispose();
    _endFocus.dispose();
    _startDebounce?.cancel();
    _endDebounce?.cancel();
    super.dispose();
  }

  // ── Photon geocoding ───────────────────────────────────────────────────────
  String _formatPhotonFeature(Map<String, dynamic> props) {
    final parts = <String>[];
    if (props['name'] != null) parts.add(props['name'].toString());
    final street = props['street'];
    if (street != null && street != props['name']) parts.add(street.toString());
    final city = props['city'] ??
        props['town'] ??
        props['village'] ??
        props['suburb'];
    if (city != null) parts.add(city.toString());
    return parts.isNotEmpty ? parts.join(', ') : 'Lokasi tidak bernama';
  }

  Future<List<PhotonPlace>> _fetchPhotonSuggestions(String query) async {
    if (query.length < 3) return [];
    setState(() {
      _debugError = null;
    });
    try {
      final uri = Uri.parse(
          'https://photon.komoot.io/api?q=${Uri.encodeComponent(query)}&limit=5&countrycode=id');
      final res = await http.get(uri, headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      }).timeout(const Duration(seconds: 5));

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final features = data['features'] as List<dynamic>? ?? [];
        return features.map<PhotonPlace>((f) {
          final coords = f['geometry']['coordinates'] as List<dynamic>;
          final props = Map<String, dynamic>.from(f['properties'] ?? {});
          return PhotonPlace(
            lat: (coords[1] as num).toDouble(),
            lon: (coords[0] as num).toDouble(),
            name: _formatPhotonFeature(props),
          );
        }).toList();
      } else {
        setState(() {
          _debugError = 'HTTP Error ${res.statusCode} from Photon';
        });
      }
    } catch (e) {
      debugPrint('Photon geocoding error: $e');
      setState(() {
        _debugError = e.toString();
      });
    }
    return [];
  }

  void _onStartQueryChanged(String val) {
    _startDebounce?.cancel();
    if (val.length < 3) {
      setState(() {
        _startSuggestions = [];
        _showStartSuggestions = false;
      });
      return;
    }
    setState(() {
      _isSearchingStart = true;
      _showStartSuggestions = true;
    });
    _startDebounce = Timer(const Duration(milliseconds: 600), () async {
      final results = await _fetchPhotonSuggestions(val);
      if (mounted) {
        setState(() {
          _startSuggestions = results;
          _isSearchingStart = false;
        });
      }
    });
  }

  void _onEndQueryChanged(String val) {
    _endDebounce?.cancel();
    if (val.length < 3) {
      setState(() {
        _endSuggestions = [];
        _showEndSuggestions = false;
      });
      return;
    }
    setState(() {
      _isSearchingEnd = true;
      _showEndSuggestions = true;
    });
    _endDebounce = Timer(const Duration(milliseconds: 600), () async {
      final results = await _fetchPhotonSuggestions(val);
      if (mounted) {
        setState(() {
          _endSuggestions = results;
          _isSearchingEnd = false;
        });
      }
    });
  }

  void _selectStart(PhotonPlace place) {
    setState(() {
      _startPlace = place;
      _startController.text = place.name;
      _startSuggestions = [];
      _showStartSuggestions = false;
      _deviceLocation = null; // Clear GPS override when manually selected
    });
    _startFocus.unfocus();
    _mapController.move(LatLng(place.lat, place.lon), 15.0);
    _calculateRoutes();
  }

  void _selectEnd(PhotonPlace place) {
    setState(() {
      _endPlace = place;
      _endController.text = place.name;
      _endSuggestions = [];
      _showEndSuggestions = false;
    });
    _endFocus.unfocus();
    _mapController.move(LatLng(place.lat, place.lon), 15.0);
    _calculateRoutes();
  }

  // ── Data init ──────────────────────────────────────────────────────────────
  Future<void> _initData() async {
    await _fetchDbPotholes();
    _calculateRoutes();
  }

  // ── GPS ───────────────────────────────────────────────────────────────────
  Future<void> _useDeviceLocation() async {
    setState(() => _isLocating = true);
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) throw 'Layanan lokasi (GPS) tidak aktif.';

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          throw 'Izin lokasi ditolak oleh pengguna.';
        }
      }
      if (permission == LocationPermission.deniedForever) {
        throw 'Izin lokasi ditolak secara permanen.';
      }

      Position position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );
      final gpsLatLng = LatLng(position.latitude, position.longitude);

      setState(() {
        _deviceLocation = gpsLatLng;
        _startPlace = PhotonPlace(
          lat: gpsLatLng.latitude,
          lon: gpsLatLng.longitude,
          name: 'Lokasi GPS Saya',
        );
        _startController.text = 'Lokasi GPS Saya';
        _isLocating = false;
      });

      _mapController.move(gpsLatLng, 14.5);
      _calculateRoutes();
    } catch (e) {
      debugPrint('Failed to get location: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('GPS Error: $e')),
        );
        setState(() => _isLocating = false);
      }
    }
  }

  // ── Pothole fetch ──────────────────────────────────────────────────────────
  Future<void> _fetchDbPotholes() async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/public/reports'));
      if (res.statusCode == 200) {
        final List<dynamic> list = jsonDecode(res.body);
        if (mounted) {
          setState(() {
            _dbPotholes = list.where((p) {
              return p['latitude'] != null &&
                  p['longitude'] != null &&
                  p['status'] != 'SELESAI';
            }).toList();
          });
        }
      }
    } catch (e) {
      debugPrint('Error fetching db potholes: $e');
    }
  }

  // ── Route calculation ──────────────────────────────────────────────────────
  double _getDistanceToSegment(LatLng p, LatLng s1, LatLng s2) {
    final double x = p.longitude;
    final double y = p.latitude;
    final double x1 = s1.longitude;
    final double y1 = s1.latitude;
    final double x2 = s2.longitude;
    final double y2 = s2.latitude;

    final double dx = x2 - x1;
    final double dy = y2 - y1;
    final double lenSq = dx * dx + dy * dy;

    double nx = x1;
    double ny = y1;

    if (lenSq > 0) {
      double t = ((x - x1) * dx + (y - y1) * dy) / lenSq;
      t = t.clamp(0.0, 1.0);
      nx = x1 + t * dx;
      ny = y1 + t * dy;
    }

    final double latMid = (y + ny) / 2.0;
    final double dLat = (y - ny) * 111139.0;
    final double dLon =
        (x - nx) * 111139.0 * math.cos(latMid * math.pi / 180.0);

    return math.sqrt(dLat * dLat + dLon * dLon);
  }

  LatLng get _startLatLng =>
      _deviceLocation ??
      (_startPlace != null
          ? LatLng(_startPlace!.lat, _startPlace!.lon)
          : _graph.nodes['MONAS']!.position);

  LatLng get _endLatLng =>
      _endPlace != null
          ? LatLng(_endPlace!.lat, _endPlace!.lon)
          : _graph.nodes['SENAYAN']!.position;

  Future<void> _calculateRoutes() async {
    if (_startPlace == null && _deviceLocation == null) return;
    if (_endPlace == null) return;

    if (mounted) {
      setState(() {
        _isLoadingRoute = true;
        _osrmRoutes = [];
      });
    }

    final startPt = _startLatLng;
    final endPt = _endLatLng;

    try {
      final url =
          'https://router.project-osrm.org/route/v1/driving/${startPt.longitude},${startPt.latitude};${endPt.longitude},${endPt.latitude}?overview=full&geometries=geojson&alternatives=true';
      final res = await http
          .get(Uri.parse(url))
          .timeout(const Duration(seconds: 6));

      if (res.statusCode != 200) throw 'Gagal mendapatkan rute dari OSRM.';

      final data = jsonDecode(res.body);
      if (data['code'] != 'Ok' ||
          data['routes'] == null ||
          (data['routes'] as List).isEmpty) {
        throw 'Rute tidak ditemukan.';
      }

      final routesList = data['routes'] as List;
      List<OSRMRouteOption> calculatedOptions = [];

      for (int index = 0; index < routesList.length; index++) {
        final r = routesList[index];
        final geom = r['geometry']['coordinates'] as List;
        List<LatLng> geometryPoints =
            geom.map<LatLng>((c) => LatLng(c[1], c[0])).toList();

        List<dynamic> routePotholes = _dbPotholes.where((p) {
          final pLat = (p['latitude'] as num).toDouble();
          final pLng = (p['longitude'] as num).toDouble();
          final pLatLng = LatLng(pLat, pLng);

          for (int i = 0; i < geometryPoints.length - 1; i++) {
            final dist = _getDistanceToSegment(
                pLatLng, geometryPoints[i], geometryPoints[i + 1]);
            if (dist <= 50.0) return true;
          }
          return false;
        }).toList();

        final avoidedCount = _dbPotholes.length - routePotholes.length;

        calculatedOptions.add(OSRMRouteOption(
          index: index,
          distance: (r['distance'] as num).toDouble(),
          duration: (r['duration'] as num).toDouble(),
          geometry: geometryPoints,
          potholes: routePotholes,
          avoidedCount: avoidedCount,
        ));
      }

      calculatedOptions
          .sort((a, b) => a.potholes.length.compareTo(b.potholes.length));

      if (mounted) {
        setState(() {
          _osrmRoutes = calculatedOptions;
          _selectedRouteIndex = 0;
          _isLoadingRoute = false;
        });
      }
    } catch (e) {
      debugPrint('OSRM routing failed: $e. Falling back to local Dijkstra.');
      // Map Photon coords → closest graph node
      final startNodeId = _findClosestNode(_startLatLng);
      final endNodeId = _findClosestNode(_endLatLng);
      if (mounted) {
        setState(() {
          _isLoadingRoute = false;
          _shortestResult =
              _graph.findShortestPath(startNodeId, endNodeId, 0.0);
          _smoothestResult =
              _graph.findShortestPath(startNodeId, endNodeId, 5.0);
        });
      }
    }
  }

  String _findClosestNode(LatLng gps) {
    String closestId = 'MONAS';
    double minDistance = double.infinity;
    const distanceTool = Distance();
    _graph.nodes.forEach((id, node) {
      double dist =
          distanceTool.as(LengthUnit.Meter, gps, node.position);
      if (dist < minDistance) {
        minDistance = dist;
        closestId = id;
      }
    });
    return closestId;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BUILD
  // ─────────────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      // Dismiss suggestions when tapping outside
      onTap: () {
        _startFocus.unfocus();
        _endFocus.unfocus();
        setState(() {
          _showStartSuggestions = false;
          _showEndSuggestions = false;
        });
      },
      child: Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          title: const Text('Perencana Perjalanan AI',
              style: TextStyle(
                  fontWeight: FontWeight.bold, color: Color(0xFF172033))),
          backgroundColor: Colors.white,
          elevation: 0,
          iconTheme: const IconThemeData(color: Color(0xFF172033)),
        ),
        body: Column(
          children: [
            // ── Search panel ─────────────────────────────────────────────
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                border:
                    Border(bottom: BorderSide(color: Colors.grey[200]!)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.02),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                children: [
                  // ── Start input row ─────────────────────────────────────
                  Row(
                    children: [
                      Expanded(
                        child: _buildSearchField(
                          controller: _startController,
                          focusNode: _startFocus,
                          hint: 'Titik Awal...',
                          prefixIcon: Icons.location_on,
                          prefixColor: Colors.green,
                          isSearching: _isSearchingStart,
                          onChanged: _onStartQueryChanged,
                          onClear: () {
                            _startController.clear();
                            setState(() {
                              _startSuggestions = [];
                              _showStartSuggestions = false;
                            });
                          },
                        ),
                      ),
                      const SizedBox(width: 6),
                      // GPS button
                      IconButton(
                        onPressed: _isLocating ? null : _useDeviceLocation,
                        icon: _isLocating
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Color(0xFF1769E0)),
                              )
                            : const Icon(Icons.my_location,
                                color: Color(0xFF1769E0), size: 18),
                        tooltip: 'Gunakan Lokasi GPS',
                        style: IconButton.styleFrom(
                          backgroundColor: const Color(0xFFEEF6FF),
                          padding: const EdgeInsets.all(10),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                    ],
                  ),

                  // ── Start suggestions dropdown ──────────────────────────
                  if (_showStartSuggestions)
                    _buildSuggestionsList(
                      suggestions: _startSuggestions,
                      isSearching: _isSearchingStart,
                      onSelect: _selectStart,
                    ),

                  const SizedBox(height: 8),

                  // ── Arrow divider ──────────────────────────────────────
                  const Row(
                    children: [
                      SizedBox(width: 4),
                      Icon(Icons.arrow_downward,
                          color: Colors.grey, size: 16),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // ── Destination input row ───────────────────────────────
                  _buildSearchField(
                    controller: _endController,
                    focusNode: _endFocus,
                    hint: 'Cari Tujuan...',
                    prefixIcon: Icons.search,
                    prefixColor: Colors.red,
                    isSearching: _isSearchingEnd,
                    onChanged: _onEndQueryChanged,
                    onClear: () {
                      _endController.clear();
                      setState(() {
                        _endSuggestions = [];
                        _showEndSuggestions = false;
                      });
                    },
                  ),

                  // ── End suggestions dropdown ────────────────────────────
                  if (_showEndSuggestions)
                    _buildSuggestionsList(
                      suggestions: _endSuggestions,
                      isSearching: _isSearchingEnd,
                      onSelect: _selectEnd,
                    ),

                  const SizedBox(height: 12),

                  // ── Route type filter chips ─────────────────────────────
                  Wrap(
                    spacing: 10,
                    runSpacing: 6,
                    alignment: WrapAlignment.center,
                    children: [
                      FilterChip(
                        label: const Text('Rute Termulus (Aman AI)'),
                        selected: _preferSmoothRoute,
                        selectedColor: const Color(0xFFEEF6FF),
                        checkmarkColor: const Color(0xFF1769E0),
                        labelStyle: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: _preferSmoothRoute
                              ? const Color(0xFF1769E0)
                              : Colors.grey[700],
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                          side: BorderSide(
                            color: _preferSmoothRoute
                                ? const Color(0xFF1769E0).withOpacity(0.3)
                                : Colors.grey[300]!,
                          ),
                        ),
                        onSelected: (_) {
                          setState(() => _preferSmoothRoute = true);
                        },
                      ),
                      FilterChip(
                        label: const Text('Rute Tercepat (Ada Lubang)'),
                        selected: !_preferSmoothRoute,
                        selectedColor: Colors.red[50],
                        checkmarkColor: Colors.red[700],
                        labelStyle: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: !_preferSmoothRoute
                              ? Colors.red[700]
                              : Colors.grey[700],
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                          side: BorderSide(
                            color: !_preferSmoothRoute
                                ? Colors.red[300]!
                                : Colors.grey[300]!,
                          ),
                        ),
                        onSelected: (_) {
                          setState(() => _preferSmoothRoute = false);
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // ── Map view ─────────────────────────────────────────────────
            Expanded(
              child: Stack(
                children: [
                  FlutterMap(
                    mapController: _mapController,
                    options: MapOptions(
                      initialCenter: LatLng(-6.2024, 106.8124),
                      initialZoom: 13.5,
                    ),
                    children: [
                      TileLayer(
                        urlTemplate:
                            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                        userAgentPackageName: 'com.example.sigap_jalan',
                      ),

                      // OSRM route polylines
                      if (_osrmRoutes.isNotEmpty)
                        PolylineLayer(
                          polylines: [
                            for (int i = 0; i < _osrmRoutes.length; i++)
                              Polyline(
                                points: _osrmRoutes[i].geometry,
                                strokeWidth:
                                    i == _selectedRouteIndex ? 6.0 : 3.5,
                                color: i == _selectedRouteIndex
                                    ? (_osrmRoutes[i].potholes.isEmpty
                                        ? Colors.green[600]!
                                        : Colors.orange[700]!)
                                    : Colors.grey.withOpacity(0.35),
                                borderStrokeWidth:
                                    i == _selectedRouteIndex ? 2.0 : 0,
                                borderColor: Colors.white,
                              ),
                          ],
                        ),

                      // Dijkstra fallback
                      if (_osrmRoutes.isEmpty) ...[
                        if (_preferSmoothRoute &&
                            _smoothestResult != null)
                          PolylineLayer(
                            polylines: [
                              Polyline(
                                points: _smoothestResult!.geometry,
                                strokeWidth: 6.0,
                                color: Colors.green[600]!,
                              ),
                            ],
                          ),
                        if (!_preferSmoothRoute &&
                            _shortestResult != null)
                          PolylineLayer(
                            polylines: [
                              Polyline(
                                points: _shortestResult!.geometry,
                                strokeWidth: 6.0,
                                color: Colors.red[500]!,
                              ),
                            ],
                          ),
                      ],

                      // Dotted GPS link
                      if (_deviceLocation != null)
                        PolylineLayer(
                          polylines: [
                            Polyline(
                              points: [
                                _deviceLocation!,
                                _osrmRoutes.isNotEmpty
                                    ? _osrmRoutes[_selectedRouteIndex]
                                        .geometry
                                        .first
                                    : _endLatLng,
                              ],
                              strokeWidth: 2.5,
                              color: Colors.blue.withOpacity(0.6),
                              isDotted: true,
                            ),
                          ],
                        ),

                      // Markers
                      MarkerLayer(
                        markers: [
                          // GPS dot
                          if (_deviceLocation != null)
                            Marker(
                              point: _deviceLocation!,
                              width: 40,
                              height: 40,
                              child: Container(
                                decoration: BoxDecoration(
                                  color: Colors.blue.withOpacity(0.2),
                                  shape: BoxShape.circle,
                                ),
                                child: Center(
                                  child: Container(
                                    width: 14,
                                    height: 14,
                                    decoration: BoxDecoration(
                                      color: Colors.blue[600],
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                          color: Colors.white, width: 2),
                                      boxShadow: [
                                        BoxShadow(
                                          color:
                                              Colors.blue.withOpacity(0.5),
                                          blurRadius: 4,
                                          spreadRadius: 1,
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ),

                          // START marker
                          Marker(
                            point: _osrmRoutes.isNotEmpty
                                ? _osrmRoutes[_selectedRouteIndex]
                                    .geometry
                                    .first
                                : _startLatLng,
                            width: 80,
                            height: 80,
                            child: const Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.location_on,
                                    color: Colors.green, size: 38),
                                Text('START',
                                    style: TextStyle(
                                      fontSize: 9,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.green,
                                      backgroundColor: Colors.white,
                                    )),
                              ],
                            ),
                          ),

                          // END marker
                          Marker(
                            point: _endLatLng,
                            width: 80,
                            height: 80,
                            child: const Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.flag_rounded,
                                    color: Colors.red, size: 38),
                                Text('FINISH',
                                    style: TextStyle(
                                      fontSize: 9,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.red,
                                      backgroundColor: Colors.white,
                                    )),
                              ],
                            ),
                          ),

                          // DB pothole markers
                          ..._dbPotholes
                              .where((p) =>
                                  p['latitude'] != null &&
                                  p['longitude'] != null)
                              .map<Marker>((p) {
                            final lat =
                                (p['latitude'] as num).toDouble();
                            final lng =
                                (p['longitude'] as num).toDouble();
                            return Marker(
                              point: LatLng(lat, lng),
                              width: 28,
                              height: 28,
                              child: Container(
                                decoration: BoxDecoration(
                                  color: Colors.red[900],
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                      color: Colors.white, width: 1.5),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.red.withOpacity(0.4),
                                      blurRadius: 4,
                                      spreadRadius: 1,
                                    ),
                                  ],
                                ),
                                child: const Icon(
                                    Icons.warning_amber_rounded,
                                    color: Colors.white,
                                    size: 14),
                              ),
                            );
                          }),
                        ],
                      ),
                    ],
                  ),

                  // Center FAB
                  Positioned(
                    bottom: 16,
                    right: 16,
                    child: FloatingActionButton.small(
                      onPressed: () {
                        _mapController.move(
                            LatLng(-6.2024, 106.8124), 13.5);
                      },
                      backgroundColor: Colors.white,
                      foregroundColor: const Color(0xFF172033),
                      child: const Icon(Icons.my_location),
                    ),
                  ),

                  // Loading overlay
                  if (_isLoadingRoute)
                    Positioned.fill(
                      child: Container(
                        color: Colors.white.withOpacity(0.5),
                        child: const Center(
                          child: CircularProgressIndicator(
                            valueColor: AlwaysStoppedAnimation<Color>(
                                Color(0xFF1769E0)),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),

            // ── Route chooser bottom panel ────────────────────────────────
            if (_osrmRoutes.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius:
                      const BorderRadius.vertical(top: Radius.circular(20)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.06),
                      blurRadius: 10,
                      offset: const Offset(0, -4),
                    ),
                  ],
                ),
                child: SafeArea(
                  top: false,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text('Pilih Rute',
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF172033))),
                      const SizedBox(height: 10),
                      ...List.generate(_osrmRoutes.length, (i) {
                        final route = _osrmRoutes[i];
                        final isSelected = i == _selectedRouteIndex;
                        final distKm = route.distance / 1000;
                        final durMin = (route.duration / 60).round();
                        final isSafest = i == 0;
                        return GestureDetector(
                          onTap: () =>
                              setState(() => _selectedRouteIndex = i),
                          child: Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 10),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? const Color(0xFFEEF6FF)
                                  : Colors.grey[50],
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: isSelected
                                    ? const Color(0xFF1769E0)
                                    : Colors.grey[200]!,
                                width: isSelected ? 1.5 : 1,
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  route.potholes.isEmpty
                                      ? Icons.check_circle
                                      : Icons.warning_amber_rounded,
                                  color: route.potholes.isEmpty
                                      ? Colors.green[600]
                                      : Colors.orange[700],
                                  size: 20,
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Text(
                                            isSafest
                                                ? 'Rute Terbaik (AI)'
                                                : 'Rute Alternatif $i',
                                            style: TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.bold,
                                              color: isSelected
                                                  ? const Color(0xFF1769E0)
                                                  : const Color(0xFF172033),
                                            ),
                                          ),
                                          if (isSafest) ...[
                                            const SizedBox(width: 6),
                                            Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                      horizontal: 6,
                                                      vertical: 2),
                                              decoration: BoxDecoration(
                                                color: Colors.green[50],
                                                borderRadius:
                                                    BorderRadius.circular(6),
                                                border: Border.all(
                                                    color:
                                                        Colors.green[200]!),
                                              ),
                                              child: Text(
                                                'Termulus',
                                                style: TextStyle(
                                                  fontSize: 9,
                                                  color: Colors.green[700],
                                                  fontWeight:
                                                      FontWeight.bold,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        '${distKm.toStringAsFixed(1)} km  •  ~$durMin mnt  •  ${route.potholes.length} lubang terdeteksi',
                                        style: TextStyle(
                                            fontSize: 11,
                                            color: Colors.grey[600]),
                                      ),
                                    ],
                                  ),
                                ),
                                if (isSelected)
                                  const Icon(Icons.radio_button_checked,
                                      color: Color(0xFF1769E0), size: 18),
                              ],
                            ),
                          ),
                        );
                      }),
                    ],
                  ),
                ),
              )
            else if (!_isLoadingRoute &&
                (_shortestResult != null || _smoothestResult != null))
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.05),
                      blurRadius: 8,
                      offset: const Offset(0, -3),
                    ),
                  ],
                ),
                child: SafeArea(
                  top: false,
                  child: Text(
                    _preferSmoothRoute
                        ? 'Rute Dijkstra Lokal: menghindari ${_smoothestResult?.totalPotholes ?? 0} lubang jalan'
                        : 'Rute Terpendek Dijkstra: ${_shortestResult?.totalPotholes ?? 0} lubang di jalur',
                    textAlign: TextAlign.center,
                    style:
                        TextStyle(fontSize: 12, color: Colors.grey[600]),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  // ── Search field widget ────────────────────────────────────────────────────
  Widget _buildSearchField({
    required TextEditingController controller,
    required FocusNode focusNode,
    required String hint,
    required IconData prefixIcon,
    required Color prefixColor,
    required bool isSearching,
    required ValueChanged<String> onChanged,
    required VoidCallback onClear,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.grey[50],
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: focusNode.hasFocus
              ? const Color(0xFF1769E0).withOpacity(0.5)
              : Colors.grey[200]!,
        ),
      ),
      child: TextField(
        controller: controller,
        focusNode: focusNode,
        onChanged: onChanged,
        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
        decoration: InputDecoration(
          prefixIcon: Icon(prefixIcon, color: prefixColor, size: 18),
          suffixIcon: isSearching
              ? const Padding(
                  padding: EdgeInsets.all(12),
                  child: SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Color(0xFF1769E0)),
                  ),
                )
              : controller.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear,
                          size: 16, color: Colors.grey),
                      onPressed: onClear,
                    )
                  : null,
          hintText: hint,
          hintStyle: TextStyle(color: Colors.grey[400], fontSize: 13),
          border: InputBorder.none,
          contentPadding:
              const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
          isDense: true,
        ),
      ),
    );
  }

  // ── Suggestions list widget ────────────────────────────────────────────────
  Widget _buildSuggestionsList({
    required List<PhotonPlace> suggestions,
    required bool isSearching,
    required ValueChanged<PhotonPlace> onSelect,
  }) {
    if (_debugError != null) {
      return Container(
        margin: const EdgeInsets.only(top: 4),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.red[200]!),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            const Row(
              children: [
                Icon(Icons.error_outline, color: Colors.red, size: 16),
                SizedBox(width: 6),
                Text('Pencarian Gagal', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold, fontSize: 12)),
              ],
            ),
            const SizedBox(height: 6),
            Text(_debugError!, style: TextStyle(color: Colors.grey[700], fontSize: 11)),
          ],
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.only(top: 4),
      constraints: const BoxConstraints(maxHeight: 200),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey[200]!),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: isSearching
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(16.0),
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            )
          : suggestions.isEmpty
              ? const Padding(
                  padding: EdgeInsets.all(14),
                  child: Text('Tidak ada hasil.',
                      style:
                          TextStyle(color: Colors.grey, fontSize: 13)),
                )
              : ListView.separated(
                  shrinkWrap: true,
                  padding: EdgeInsets.zero,
                  itemCount: suggestions.length,
                  separatorBuilder: (_, __) =>
                      Divider(height: 1, color: Colors.grey[100]),
                  itemBuilder: (context, i) {
                    final place = suggestions[i];
                    return InkWell(
                      onTap: () => onSelect(place),
                      borderRadius: i == 0
                          ? const BorderRadius.vertical(
                              top: Radius.circular(10))
                          : i == suggestions.length - 1
                              ? const BorderRadius.vertical(
                                  bottom: Radius.circular(10))
                              : BorderRadius.zero,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 10),
                        child: Row(
                          children: [
                            const Icon(Icons.place_outlined,
                                size: 16, color: Color(0xFF1769E0)),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                place.name,
                                style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
