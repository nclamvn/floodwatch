-- Delete old seed data first
DELETE FROM ai_forecasts WHERE source = 'seed_script';

-- Hà Nội (4 forecasts)
INSERT INTO ai_forecasts (
  type, severity, confidence, location, lat, lon, radius_km,
  forecast_time, valid_until, model_name, model_version,
  summary, predicted_intensity, predicted_duration_hours,
  risk_factors, data_sources, is_active, source
) VALUES
-- Hà Nội #1: Flood (high, 0.88)
(
  'flood', 'high', 0.88,
  ST_SetSRID(ST_MakePoint(105.8342, 21.0278), 4326)::geography,
  21.0278, 105.8342, 12.0,
  NOW() + INTERVAL '3 hours', NOW() + INTERVAL '12 hours',
  'FloodPredictorV2', '2.1.0',
  'Dự báo nguy cơ lũ lụt cao tại khu vực Hà Nội trong 3-12 giờ tới. Mực nước sông Hồng dâng cao do mưa lớn kéo dài ở thượng nguồn. Nguy cơ ngập úng tại các quận trũng thấp như Long Biên, Gia Lâm.',
  0.82, 9,
  '["Mưa lớn kéo dài >100mm/24h", "Mực nước sông Hồng gia tăng", "Triều cường trên sông", "Hệ thống thoát nước khu nội thành quá tải"]'::jsonb,
  '["Trạm khí tượng Láng - Hà Nội", "Hệ thống radar thời tiết Viện Khí tượng", "Trạm đo mực nước sông Hồng", "Dự báo KTTV Trung ương"]'::jsonb,
  true, 'seed_script'
),
-- Hà Nội #2: Heavy Rain (medium, 0.72)
(
  'heavy_rain', 'medium', 0.72,
  ST_SetSRID(ST_MakePoint(105.8049, 21.0069), 4326)::geography,
  21.0069, 105.8049, 8.0,
  NOW() + INTERVAL '2 hours', NOW() + INTERVAL '8 hours',
  'RainPredictorV1', '1.5.0',
  'Dự báo mưa vừa đến mưa lớn tại khu vực trung tâm Hà Nội với lượng mưa 40-80mm. Ảnh hưởng từ dải hội tụ nhiệt đới. Nguy cơ ngập úng cục bộ tại các điểm trũng.',
  0.68, 6,
  '["Dải hội tụ nhiệt đới hoạt động mạnh", "Độ ẩm không khí cao", "Gió Đông Nam mạnh"]'::jsonb,
  '["Trạm Láng", "Radar Viện Khí tượng", "Mô hình WRF"]'::jsonb,
  true, 'seed_script'
),
-- Hà Nội #3: Landslide (medium, 0.68)
(
  'landslide', 'medium', 0.68,
  ST_SetSRID(ST_MakePoint(105.4117, 21.1694), 4326)::geography,
  21.1694, 105.4117, 6.0,
  NOW() + INTERVAL '4 hours', NOW() + INTERVAL '16 hours',
  'SlopePredictorV1', '1.2.0',
  'Cảnh báo nguy cơ sạt lở đất tại khu vực Ba Vì sau mưa lớn kéo dài. Đất đá bị bão hòa nước, độ dốc cao. Khuyến cáo người dân khu vực núi di dời đến nơi an toàn.',
  0.71, 12,
  '["Mưa lớn kéo dài làm bão hòa đất", "Địa hình dốc >30 độ", "Đất đá lẫn đá phiến yếu"]'::jsonb,
  '["Khảo sát thực địa", "Dữ liệu địa chất", "Lượng mưa vùng núi"]'::jsonb,
  true, 'seed_script'
),
-- Hà Nội #4: Storm (critical, 0.91)
(
  'storm', 'critical', 0.91,
  ST_SetSRID(ST_MakePoint(105.8542, 21.0378), 4326)::geography,
  21.0378, 105.8542, 25.0,
  NOW() + INTERVAL '6 hours', NOW() + INTERVAL '18 hours',
  'StormTrackerV3', '3.0.1',
  'CẢNH BÁO KHẨN: Bão số 5 di chuyển vào vịnh Bắc Bộ, ảnh hưởng trực tiếp Hà Nội. Gió giật cấp 9-10, mưa rất to 150-250mm. Nguy cơ ngập sâu, cây đổ, mất điện diện rộng. CẦN DI DỜI DÂN KHẨN CẤP.',
  0.95, 12,
  '["Bão cấp 10 tiến vào đất liền", "Mưa cực lớn >200mm", "Gió giật trên cấp 10", "Triều cường cao"]'::jsonb,
  '["Trung tâm Dự báo KTTV", "Vệ tinh khí tượng MTSAT", "Radar thời tiết Vinadif", "Mô hình ECMWF"]'::jsonb,
  true, 'seed_script'
),

-- TP.HCM (4 forecasts)
-- TP.HCM #1: Flood (high, 0.85)
(
  'flood', 'high', 0.85,
  ST_SetSRID(ST_MakePoint(106.6297, 10.8231), 4326)::geography,
  10.8231, 106.6297, 15.0,
  NOW() + INTERVAL '2 hours', NOW() + INTERVAL '10 hours',
  'FloodPredictorV2', '2.1.0',
  'Nguy cơ ngập lụt cao tại TP.HCM do triều cường kết hợp mưa lớn. Mực nước Sài Gòn vượt báo động 2. Các quận 1, 4, 7, Bình Thạnh, Thủ Đức có nguy cơ ngập sâu 40-80cm. Giao thông bị chia cắt.',
  0.87, 8,
  '["Triều cường cao nhất năm", "Mưa lớn >100mm", "Hệ thống thoát nước quá tải", "Mực nước sông Sài Gòn cao"]'::jsonb,
  '["Trạm Tân Sơn Nhất", "Trạm đo triều Nhà Bè", "Radar Nam Bộ", "KTTV Nam Bộ"]'::jsonb,
  true, 'seed_script'
),
-- TP.HCM #2: Heavy Rain (medium, 0.75)
(
  'heavy_rain', 'medium', 0.75,
  ST_SetSRID(ST_MakePoint(106.6828, 10.7622), 4326)::geography,
  10.7622, 106.6828, 10.0,
  NOW() + INTERVAL '1 hour', NOW() + INTERVAL '5 hours',
  'RainPredictorV1', '1.5.0',
  'Mưa dông mạnh tại khu vực trung tâm TP.HCM với lượng mưa 50-100mm trong 4 giờ tới. Khả năng có sét, lốc xoáy. Ngập úng cục bộ tại các tuyến đường Nguyễn Hữu Cảnh, Trường Sa, Võ Văn Kiệt.',
  0.72, 4,
  '["Mây dông phát triển mạnh", "Độ ẩm >85%", "Gió Tây Nam mạnh"]'::jsonb,
  '["Radar Tân Sơn Nhất", "Trạm tự động khu vực", "Vệ tinh Himawari-9"]'::jsonb,
  true, 'seed_script'
),
-- TP.HCM #3: Tide Surge (high, 0.82)
(
  'tide_surge', 'high', 0.82,
  ST_SetSRID(ST_MakePoint(106.7052, 10.7811), 4326)::geography,
  10.7811, 106.7052, 18.0,
  NOW() + INTERVAL '4 hours', NOW() + INTERVAL '14 hours',
  'TidePredictorV1', '1.3.0',
  'Triều cường cao nhất tháng tại TP.HCM, đạt 1.65m vào 15h chiều nay. Kết hợp với gió mùa Tây Nam mạnh. Ngập nặng tại quận 4, 7, 8, Nhà Bè, Cần Giờ. Giao thông ven sông bị ảnh hưởng nghiêm trọng.',
  0.89, 10,
  '["Triều cường đạt đỉnh", "Gió Tây Nam >40km/h đẩy nước vào", "Trăng tròn tác động"]'::jsonb,
  '["Trạm đo triều Vũng Tàu", "Trạm Nhà Bè", "Dự báo thiên văn triều"]'::jsonb,
  true, 'seed_script'
),
-- TP.HCM #4: Storm (critical, 0.89)
(
  'storm', 'critical', 0.89,
  ST_SetSRID(ST_MakePoint(106.6497, 10.8031), 4326)::geography,
  10.8031, 106.6497, 30.0,
  NOW() + INTERVAL '8 hours', NOW() + INTERVAL '24 hours',
  'StormTrackerV3', '3.0.1',
  'BÃO NHIỆT ĐỚI tiến vào Nam Bộ, ảnh hưởng trực tiếp TP.HCM sau 8 giờ. Gió mạnh cấp 8-9, giật cấp 11. Mưa rất to 200-350mm. NGUY CƠ CAO: ngập sâu, cây đổ, tốc mái nhà, mất điện, sóng lớn ven biển.',
  0.92, 16,
  '["Bão cấp 9 hướng vào TP.HCM", "Mưa cực lớn >300mm", "Triều cường trùng pha", "Gió giật >100km/h"]'::jsonb,
  '["Trung tâm KTTV Trung ương", "Đài KTTV Nam Bộ", "Vệ tinh MTSAT", "Mô hình GFS"]'::jsonb,
  true, 'seed_script'
),

-- Đà Nẵng (3 forecasts)
-- Đà Nẵng #1: Tide Surge (high, 0.87)
(
  'tide_surge', 'high', 0.87,
  ST_SetSRID(ST_MakePoint(108.2208, 16.0544), 4326)::geography,
  16.0544, 108.2208, 12.0,
  NOW() + INTERVAL '3 hours', NOW() + INTERVAL '11 hours',
  'TidePredictorV1', '1.3.0',
  'Triều cường ảnh hưởng khu vực Đà Nẵng, mực nước biển dâng cao 1.2-1.5m. Ngập úng tại các khu vực ven sông Hàn, bãi biển Mỹ Khê, Sơn Trà. Giao thông ven biển bị ảnh hưởng.',
  0.84, 8,
  '["Triều cường cao", "Gió Đông Bắc mạnh đẩy nước vào bờ", "Mưa nhỏ kèm theo"]'::jsonb,
  '["Trạm đo triều Đà Nẵng", "Trạm hải văn Sơn Trà", "KTTV Trung Trung Bộ"]'::jsonb,
  true, 'seed_script'
),
-- Đà Nẵng #2: Heavy Rain (medium, 0.70)
(
  'heavy_rain', 'medium', 0.70,
  ST_SetSRID(ST_MakePoint(108.2022, 16.0678), 4326)::geography,
  16.0678, 108.2022, 8.0,
  NOW() + INTERVAL '2 hours', NOW() + INTERVAL '7 hours',
  'RainPredictorV1', '1.5.0',
  'Mưa vừa đến mưa lớn tại Đà Nẵng với lượng mưa 50-90mm. Ảnh hưởng từ không khí lạnh kết hợp gió Đông Bắc. Ngập nhẹ tại các tuyến đường trũng như Ông Ích Khiêm, Ngô Quyền.',
  0.69, 5,
  '["Không khí lạnh tăng cường", "Gió Đông Bắc mạnh", "Độ ẩm cao"]'::jsonb,
  '["Trạm Đà Nẵng", "Radar Trung Bộ", "Mô hình WRF"]'::jsonb,
  true, 'seed_script'
),
-- Đà Nẵng #3: Flood (medium, 0.73)
(
  'flood', 'medium', 0.73,
  ST_SetSRID(ST_MakePoint(108.1511, 16.0239), 4326)::geography,
  16.0239, 108.1511, 10.0,
  NOW() + INTERVAL '5 hours', NOW() + INTERVAL '15 hours',
  'FloodPredictorV2', '2.1.0',
  'Nguy cơ ngập lụt tại khu vực hạ lưu sông Hàn do mưa lớn ở thượng nguồn. Mực nước sông dâng cao. Các quận Hải Châu, Thanh Khê có nguy cơ ngập 20-40cm vào chiều tối.',
  0.71, 10,
  '["Mưa thượng nguồn lớn", "Mực nước sông Hàn dâng", "Triều cao ngăn nước thoát"]'::jsonb,
  '["Trạm thủy văn Cẩm Lệ", "Trạm mưa Ba Nà", "KTTV Đà Nẵng"]'::jsonb,
  true, 'seed_script'
),

-- Cần Thơ (2 forecasts)
-- Cần Thơ #1: Flood (high, 0.84)
(
  'flood', 'high', 0.84,
  ST_SetSRID(ST_MakePoint(105.7851, 10.0341), 4326)::geography,
  10.0341, 105.7851, 14.0,
  NOW() + INTERVAL '4 hours', NOW() + INTERVAL '12 hours',
  'FloodPredictorV2', '2.1.0',
  'Cảnh báo ngập lụt tại Cần Thơ do triều cường sông Hậu kết hợp mưa lớn. Mực nước vượt báo động 2. Các quận Ninh Kiều, Cái Răng, Thốt Nốt ngập 30-60cm. Giao thông nội thành khó khăn.',
  0.83, 8,
  '["Triều cường sông Hậu", "Mưa lớn >80mm", "Hệ thống thoát nước kém", "Nước lũ từ thượng nguồn"]'::jsonb,
  '["Trạm thủy văn Cần Thơ", "Trạm mưa tự động", "KTTV ĐBSCL"]'::jsonb,
  true, 'seed_script'
),
-- Cần Thơ #2: Heavy Rain (medium, 0.71)
(
  'heavy_rain', 'medium', 0.71,
  ST_SetSRID(ST_MakePoint(105.7676, 10.0145), 4326)::geography,
  10.0145, 105.7676, 9.0,
  NOW() + INTERVAL '1 hour', NOW() + INTERVAL '6 hours',
  'RainPredictorV1', '1.5.0',
  'Mưa dông mạnh tại khu vực Cần Thơ với lượng mưa 60-100mm. Có sét, lốc. Ngập úng cục bộ tại các tuyến đường trũng như 3/2, Mậu Thân, Nguyễn Văn Cừ.',
  0.68, 5,
  '["Mây dông phát triển", "Gió Tây Nam mạnh", "Độ ẩm rất cao"]'::jsonb,
  '["Trạm Cần Thơ", "Radar ĐBSCL", "Vệ tinh Himawari"]'::jsonb,
  true, 'seed_script'
),

-- Huế (2 forecasts)
-- Huế #1: Flood (high, 0.86)
(
  'flood', 'high', 0.86,
  ST_SetSRID(ST_MakePoint(107.5909, 16.4637), 4326)::geography,
  16.4637, 107.5909, 16.0,
  NOW() + INTERVAL '6 hours', NOW() + INTERVAL '18 hours',
  'FloodPredictorV2', '2.1.0',
  'LŨ LỤT LỚN tại Huế do mưa lũ miền núi. Mực nước sông Hương, sông Bồ vượt báo động 3. Ngập sâu 1-2m tại khu vực thấp trũng. Cần di dời dân khẩn cấp khỏi vùng nguy hiểm.',
  0.91, 12,
  '["Mưa rất lớn miền núi >500mm", "Nước lũ từ thượng nguồn ầm ầm đổ về", "Mực nước sông vượt báo động 3", "Xả lũ các hồ chứa"]'::jsonb,
  '["Trạm thủy văn Huế", "Trạm mưa A Lưới", "Trạm Bến Gót", "KTTV Trung Trung Bộ"]'::jsonb,
  true, 'seed_script'
),
-- Huế #2: Landslide (critical, 0.93)
(
  'landslide', 'critical', 0.93,
  ST_SetSRID(ST_MakePoint(107.3526, 16.3389), 4326)::geography,
  16.3389, 107.3526, 8.0,
  NOW() + INTERVAL '3 hours', NOW() + INTERVAL '20 hours',
  'SlopePredictorV1', '1.2.0',
  'NGUY CƠ SẠT LỞ ĐẤT CỰC KỲ NGHIÊM TRỌNG tại khu vực miền núi Huế (A Lưới, Nam Đông). Mưa lớn kéo dài làm đất đá bão hòa. Đã xuất hiện vết nứt, có thể sạt lở hàng nghìn m3 đất đá. CẤM DI CHUYỂN QUA KHU VỰC.',
  0.97, 16,
  '["Mưa liên tục >600mm", "Đất đá bão hòa nước", "Xuất hiện vết nứt lớn", "Địa hình dốc >45 độ", "Đã có tiền lệ sạt lở"]'::jsonb,
  '["Khảo sát thực địa", "Dữ liệu địa chất Huế", "Lượng mưa trạm A Lưới", "Camera giám sát sườn núi"]'::jsonb,
  true, 'seed_script'
),

-- Quảng Ninh (1 forecast)
-- Quảng Ninh #1: Storm (high, 0.81)
(
  'storm', 'high', 0.81,
  ST_SetSRID(ST_MakePoint(107.0729, 20.9502), 4326)::geography,
  20.9502, 107.0729, 20.0,
  NOW() + INTERVAL '10 hours', NOW() + INTERVAL '30 hours',
  'StormTrackerV3', '3.0.1',
  'Bão số 6 di chuyển vào vịnh Bắc Bộ, ảnh hưởng Quảng Ninh. Gió mạnh cấp 7-8, vùng gần tâm bão cấp 9-10, giật cấp 12. Sóng biển cao 3-5m. Mưa to 100-200mm. Cảng biển, tàu thuyền cần tránh trú.',
  0.85, 20,
  '["Bão cấp 9 vào vịnh Bắc Bộ", "Sóng biển cao >4m", "Gió giật cấp 12", "Mưa lớn >150mm"]'::jsonb,
  '["Đài KTTV Quảng Ninh", "Vệ tinh MTSAT", "Radar Bãi Cháy", "Mô hình ECMWF"]'::jsonb,
  true, 'seed_script'
),

-- Nghệ An (1 forecast)
-- Nghệ An #1: Flood (medium, 0.69)
(
  'flood', 'medium', 0.69,
  ST_SetSRID(ST_MakePoint(105.6881, 18.6738), 4326)::geography,
  18.6738, 105.6881, 12.0,
  NOW() + INTERVAL '7 hours', NOW() + INTERVAL '20 hours',
  'FloodPredictorV2', '2.1.0',
  'Nguy cơ ngập lụt tại vùng hạ lưu Nghệ An do mưa lớn vùng núi. Mực nước sông Lam, sông Cả dâng cao. Các huyện Nam Đàn, Hưng Nguyên có nguy cơ ngập 30-50cm.',
  0.72, 13,
  '["Mưa lớn vùng núi Nghệ An", "Mực nước sông Lam tăng", "Đất trũng thoát nước kém"]'::jsonb,
  '["Trạm thủy văn Nghệ An", "Trạm mưa Kỳ Sơn", "KTTV Bắc Trung Bộ"]'::jsonb,
  true, 'seed_script'
),

-- Bình Định (1 forecast)
-- Bình Định #1: Tide Surge (medium, 0.74)
(
  'tide_surge', 'medium', 0.74,
  ST_SetSRID(ST_MakePoint(109.2189, 13.7830), 4326)::geography,
  13.7830, 109.2189, 11.0,
  NOW() + INTERVAL '5 hours', NOW() + INTERVAL '13 hours',
  'TidePredictorV1', '1.3.0',
  'Triều cường ảnh hưởng ven biển Bình Định. Mực nước biển dâng 1.0-1.3m. Ngập nhẹ tại các khu vực ven biển Quy Nhơn, Nhơn Lý. Sóng cao, cảnh báo tàu thuyền nhỏ.',
  0.76, 8,
  '["Triều cường", "Gió Đông Bắc mạnh", "Sóng biển cao 2-3m"]'::jsonb,
  '["Trạm đo triều Quy Nhơn", "Trạm hải văn Bình Định", "KTTV Nam Trung Bộ"]'::jsonb,
  true, 'seed_script'
);
