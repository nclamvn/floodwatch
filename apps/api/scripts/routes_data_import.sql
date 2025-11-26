-- Clear existing routes data first
DELETE FROM road_events;
DELETE FROM traffic_disruptions;
DELETE FROM road_segments;
--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8 (Debian 15.8-1.pgdg110+1)
-- Dumped by pg_dump version 15.8 (Debian 15.8-1.pgdg110+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: road_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.road_events (id, created_at, updated_at, segment_name, status, reason, province, district, lat, lon, location, last_verified, source, lifecycle_status, last_verified_at, resolved_at, archived_at) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-11-17 08:52:11.545373+00', '2025-11-26 15:21:20.121614+00', 'QL1A Đèo Hải Vân', 'OPEN', NULL, 'Đà Nẵng', 'Liên Chiểu', 16.1974, 108.1253, '0101000020E6100000158C4AEA04085B40FB3A70CE88323040', '2025-11-17 13:22:11.545373+00', 'PRESS', 'ARCHIVED', '2025-11-17 13:22:11.545373+00', '2025-11-20 08:52:11.545373+00', '2025-11-26 15:21:20.121614+00');
INSERT INTO public.road_events (id, created_at, updated_at, segment_name, status, reason, province, district, lat, lon, location, last_verified, source, lifecycle_status, last_verified_at, resolved_at, archived_at) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2025-11-17 07:52:11.545373+00', '2025-11-26 15:21:20.121614+00', 'QL9 Lao Bảo', 'CLOSED', 'Sạt lở đá nghiêm trọng, giao thông tê liệt', 'Quảng Trị', 'Hướng Hóa', 16.6463, 106.7303, '0101000020E61000003411363CBDAE5A40A167B3EA73A53040', '2025-11-17 12:52:11.545373+00', 'PRESS', 'ARCHIVED', '2025-11-17 12:52:11.545373+00', '2025-11-20 07:52:11.545373+00', '2025-11-26 15:21:20.121614+00');
INSERT INTO public.road_events (id, created_at, updated_at, segment_name, status, reason, province, district, lat, lon, location, last_verified, source, lifecycle_status, last_verified_at, resolved_at, archived_at) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '2025-11-17 10:52:11.545373+00', '2025-11-26 15:21:20.121614+00', 'Đường Hồ Chí Minh', 'RESTRICTED', 'Ngập nước cục bộ, chỉ xe cao có thể qua', 'Quảng Nam', 'Nam Giang', 15.54, 107.72, '0101000020E6100000AE47E17A14EE5A4014AE47E17A142F40', '2025-11-17 13:07:11.545373+00', 'PRESS', 'ARCHIVED', '2025-11-17 13:07:11.545373+00', '2025-11-20 10:52:11.545373+00', '2025-11-26 15:21:20.121614+00');
INSERT INTO public.road_events (id, created_at, updated_at, segment_name, status, reason, province, district, lat, lon, location, last_verified, source, lifecycle_status, last_verified_at, resolved_at, archived_at) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '2025-11-17 09:52:11.545373+00', '2025-11-26 15:21:20.121614+00', 'QL14B Kon Tum - Quảng Nam', 'OPEN', NULL, 'Quảng Nam', 'Bắc Trà My', 15.2897, 108.0109, '0101000020E6100000B1E1E995B2005B406A4DF38E53942E40', '2025-11-17 13:32:11.545373+00', 'PRESS', 'ARCHIVED', '2025-11-17 13:32:11.545373+00', '2025-11-20 09:52:11.545373+00', '2025-11-26 15:21:20.121614+00');
INSERT INTO public.road_events (id, created_at, updated_at, segment_name, status, reason, province, district, lat, lon, location, last_verified, source, lifecycle_status, last_verified_at, resolved_at, archived_at) VALUES ('9f0a6cd7-2cde-4ad6-b86e-c4de79f290cd', '2025-11-18 10:44:01.948713+00', '2025-11-26 15:21:20.121614+00', 'QL1A', 'CLOSED', 'Sạt lở nghiêm trọng', 'Thừa Thiên Huế', NULL, NULL, NULL, NULL, '2025-11-18 17:44:01.90547+00', 'PRESS', 'ARCHIVED', '2025-11-18 17:44:01.90547+00', '2025-11-21 10:44:01.948713+00', '2025-11-26 15:21:20.121614+00');
INSERT INTO public.road_events (id, created_at, updated_at, segment_name, status, reason, province, district, lat, lon, location, last_verified, source, lifecycle_status, last_verified_at, resolved_at, archived_at) VALUES ('e73c8006-f90c-44b4-accb-2687f28230e6', '2025-11-18 10:44:50.705523+00', '2025-11-26 15:21:20.121614+00', 'QL1A', 'RESTRICTED', 'Mưa lớn, hạn chế tốc độ', 'Quảng Trị', NULL, NULL, NULL, NULL, '2025-11-18 17:44:50.672557+00', 'PRESS', 'ARCHIVED', '2025-11-18 17:44:50.672557+00', '2025-11-21 10:44:50.705523+00', '2025-11-26 15:21:20.121614+00');
INSERT INTO public.road_events (id, created_at, updated_at, segment_name, status, reason, province, district, lat, lon, location, last_verified, source, lifecycle_status, last_verified_at, resolved_at, archived_at) VALUES ('8b48fd7f-7f76-4c67-9856-f9b1138d502d', '2025-11-18 10:44:02.11087+00', '2025-11-26 15:21:20.121614+00', 'Đèo Nhông', 'CLOSED', 'Sạt lở nghiêm trọng', 'Bình Định', 'Phù Mỹ', 14.0847, 108.9203, '0101000020E610000090A0F831E63A5B4041F163CC5D2B2C40', '2025-11-18 17:44:01.905494+00', 'PRESS', 'ARCHIVED', '2025-11-18 17:44:01.905494+00', '2025-11-21 10:44:02.11087+00', '2025-11-26 15:21:20.121614+00');


--
-- Data for Name: road_segments; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.road_segments (id, created_at, updated_at, segment_name, road_name, province, district, start_lat, start_lon, end_lat, end_lon, status, status_reason, risk_score, hazard_event_id, normalized_name, content_hash, source_domain, source_url, source, verified_at, verified_by, expires_at, legacy_road_event_id, legacy_disruption_id, location, geometry, lifecycle_status, last_verified_at, resolved_at, archived_at) VALUES ('7f4ef8a4-c37d-4239-bbb5-def9eccfb55e', '2025-11-26 14:55:31.079232+00', '2025-11-26 15:09:35.018094+00', 'QL 27C - Khánh Hòa', 'QL 27C', 'Khánh Hòa', NULL, 12.2388, 109.1967, NULL, NULL, 'CLOSED', 'Mưa lũ kéo dài, hơn 40 điểm đèo Khánh Lê (quốc lộ 27C) sạt lở, sụt lún nghiêm trọng chia cắt tuyến huyết mạch nối Nha Trang – Đà Lạt nhiều ngày qua.', 0.95, NULL, 'ql 27c - khánh hòa', '9804944b86df84f1df07eaae0bf0a82a', 'vnexpress.net', 'https://vnexpress.net/deo-khanh-le-bi-xe-toac-sau-chuoi-sat-lo-sut-lun-4986279.html', 'PRESS', '2025-11-26 09:00:00+00', NULL, '2025-12-03 14:55:31.079234+00', NULL, NULL, '0101000020E6100000E3C798BB964C5B40D1915CFE437A2840', NULL, 'ACTIVE', '2025-11-26 09:00:00+00', NULL, NULL);
INSERT INTO public.road_segments (id, created_at, updated_at, segment_name, road_name, province, district, start_lat, start_lon, end_lat, end_lon, status, status_reason, risk_score, hazard_event_id, normalized_name, content_hash, source_domain, source_url, source, verified_at, verified_by, expires_at, legacy_road_event_id, legacy_disruption_id, location, geometry, lifecycle_status, last_verified_at, resolved_at, archived_at) VALUES ('d64dbd67-e8e7-4610-9df9-cbca1f1044a1', '2025-11-26 14:55:30.600629+00', '2025-11-26 15:09:35.018094+00', 'QL 20 - Lâm Đồng', 'QL 20', 'Lâm Đồng', NULL, 11.9033, 108.4256, NULL, NULL, 'CLOSED', 'Trong thời gian chờ thi công cầu cạn, các cơ quan chức năng sẽ mở đường phụ để né điểm sạt lở trên đèo Mimosa - Ảnh: M.V.

Ngày 26-11, Ban Quản lý dự án 85 (Ban 85) cho biết các đơn vị đang xử lý khối đất đá sạt trượt, gia cố ta luy và thảm nhựa trên đèo Mimosa (quốc lộ 20), nhằm tạo đường tạm hai làn xe. Nếu thời tiết thuận lợi, đoạn bị chia cắt có thể thông xe trong 2 ngày tới.





Về giải pháp lâu dài, Ban 85 đề xuất Bộ Xây dựng chấp thuận phương án xây cầu dài 107m theo tiêu chuẩn đường cấp 3 miền núi, hai làn xe, tổng mức đầu tư khoảng 30 tỉ đồng. Công trình dự kiến triển khai theo lệnh khẩn cấp, thi công khoảng 4 tháng.

Phương án cầu cạn sẽ giúp giảm độ cong tuyến đèo hiện hữu, các trụ và móng cọc cắm sâu về phía ta luy âm giúp ổn định mái dốc, an toàn hơn so với giải pháp chỉ đắp đường dễ tái sạt. Trong thời gian thi công, xe cộ vẫn lưu thông trên đường cũ đã sửa tạm.

Hiện trường vụ sạt lở trên đèo Mimosa Đà Lạt - Ảnh: M.V.

Đèo Mimosa dài khoảng 11km, là cửa ngõ phía nam Đà ', 0.95, NULL, 'ql 20 - lâm đồng', '939c1711d46ead56ba756f67bb0c5c40', 'tuoitre.vn', 'https://tuoitre.vn/kien-nghi-xay-cau-dai-107m-vuot-diem-sat-lo-deo-mimosa-da-lat-20251126171921757.htm', 'PRESS', '2025-11-26 13:14:12.037648+00', NULL, '2025-12-03 14:55:30.600631+00', NULL, NULL, '0101000020E61000005E4BC8073D1B5B401FF46C567DCE2740', NULL, 'ACTIVE', '2025-11-26 13:14:12.037648+00', NULL, NULL);
INSERT INTO public.road_segments (id, created_at, updated_at, segment_name, road_name, province, district, start_lat, start_lon, end_lat, end_lon, status, status_reason, risk_score, hazard_event_id, normalized_name, content_hash, source_domain, source_url, source, verified_at, verified_by, expires_at, legacy_road_event_id, legacy_disruption_id, location, geometry, lifecycle_status, last_verified_at, resolved_at, archived_at) VALUES ('507c5079-5964-4d86-82fa-569385e555d6', '2025-11-26 14:55:30.756105+00', '2025-11-26 15:09:35.018094+00', 'QL 25 - Gia Lai', 'QL 25', 'Gia Lai', NULL, 13.8078, 108.1093, NULL, NULL, 'CLOSED', 'Ngày 26/11, ông Hà Anh Thái, Phó giám đốc Sở Xây dựng tỉnh Gia Lai cho biết, đơn vị này vừa tổng hợp thiệt hại hệ thống đường giao thông trong đợt bão số 13 và đợt mưa lũ kéo dài.

Đường Trường Sơn Đông qua Gia Lai sạt lở, hư hỏng nghiêm trọng.

Ông Hà Anh Thái cho hay, sau bão số 13 và đợt mưa lớn liên tục từ ngày 16 đến 20/11, nhiều tuyến giao thông trên địa bàn tỉnh Gia Lai hư hỏng nặng, phát sinh hàng loạt điểm sạt lở, xói lở mặt đường, hư hỏng cầu cống và hệ thống hạ tầng đô thị.

Đến hiện tại, các tuyến quốc lộ và đường tỉnh trên địa bàn Gia Lai được thông xe tạm thời để phương tiện lưu thông. Tuy nhiên, các tuyến đường xuống cấp, nguy cơ mất an toàn vẫn còn cao tại một số điểm sạt lở, xói lở.

Theo Sở Xây dựng tỉnh Gia Lai, đơn vị này đang yêu cầu các đơn vị quản lý những tuyến đường, đơn vị thi công tiếp tục khắc phục hiện trường, duy tu tạm thời vị trí hư hỏng nhằm đảm bảo giao thông cơ bản thông suốt; đồng thời xem xét, bố trí nguồn lực để việc khôi phục hạ tầng giao thông đư', 0.95, NULL, 'ql 25 - gia lai', '839afe0724d46f288946d1dddc27571a', 'baomoi.com', 'https://baomoi.com/gia-lai-de-xuat-hon-1-300-ty-dong-khac-phuc-ha-tang-giao-thong-sau-thien-tai', 'PRESS', '2025-11-26 12:42:23.333564+00', NULL, '2025-12-03 14:55:30.756107+00', NULL, NULL, '0101000020E6100000FB5C6DC5FE065B40E86A2BF6979D2B40', NULL, 'ACTIVE', '2025-11-26 12:42:23.333564+00', NULL, NULL);
INSERT INTO public.road_segments (id, created_at, updated_at, segment_name, road_name, province, district, start_lat, start_lon, end_lat, end_lon, status, status_reason, risk_score, hazard_event_id, normalized_name, content_hash, source_domain, source_url, source, verified_at, verified_by, expires_at, legacy_road_event_id, legacy_disruption_id, location, geometry, lifecycle_status, last_verified_at, resolved_at, archived_at) VALUES ('f02f0430-31c0-4e20-9aa9-24546357980c', '2025-11-26 14:55:32.669247+00', '2025-11-26 15:14:05.747959+00', 'Đồng Nai yêu cầu 17 nhà thủy điện cung cấp thông tin xả lũ (Đồng Nai)', NULL, 'Đồng Nai', NULL, 10.9524, 107.1676, NULL, NULL, 'LIMITED', 'Trước nguy cơ ngập lụt và thiệt hại hoa màu, tỉnh Đồng Nai yêu cầu 17 thủy điện phối hợp cung cấp thông tin xả lũ đến chính quyền và người dân vùng hạ du để đảm bảo an toàn.', 0.5, NULL, 'đồng nai yêu cầu 17 nhà thủy điện cung cấp thông tin xả lũ (đồng nai)', '39c0532bc20db85627f6ac19a9db5ffd', 'vietnamnet.vn', 'https://vietnamnet.vn/dong-nai-yeu-cau-17-nha-thuy-dien-cung-cap-thong-tin-xa-lu-2465383.html', 'PRESS', '2025-11-24 03:18:06+00', NULL, '2025-12-03 14:55:32.669249+00', NULL, NULL, '0101000020E6100000D0B359F5B9CA5A40BA6B09F9A0E72540', NULL, 'ARCHIVED', '2025-11-24 03:18:06+00', NULL, '2025-11-26 15:14:05.747959+00');
INSERT INTO public.road_segments (id, created_at, updated_at, segment_name, road_name, province, district, start_lat, start_lon, end_lat, end_lon, status, status_reason, risk_score, hazard_event_id, normalized_name, content_hash, source_domain, source_url, source, verified_at, verified_by, expires_at, legacy_road_event_id, legacy_disruption_id, location, geometry, lifecycle_status, last_verified_at, resolved_at, archived_at) VALUES ('b0de4564-d891-4bf4-bcf4-8cb4af66baa4', '2025-11-26 14:55:30.876173+00', '2025-11-26 15:09:35.018094+00', 'QL 27C - Khánh Hòa', 'QL 27C', 'Khánh Hòa', NULL, 12.2388, 109.1967, NULL, NULL, 'DANGEROUS', 'Sạt lở trên quốc lộ 27C địa bàn tỉnh Lâm Đồng - Ảnh: Sở Xây dựng tỉnh Lâm Đồng

Ngày 23-11, Sở Xây dựng tỉnh Lâm Đồng cho biết tuyến quốc lộ 27C (có đèo Khánh Lê) nối Đà Lạt - Nha Trang, đoạn từ Km65+800 đến Km117+450 (thuộc xã Lạc Dương và phường Lâm Viên - Đà Lạt), tiếp tục phát sinh sạt lở nghiêm trọng do mưa lớn kéo dài từ 16-11 đến nay, gây ách tắc giao thông nhiều điểm.

Quốc lộ 27C là tuyến đường chủ yếu là đèo, trong đó có đèo Khánh Lê vừa xảy ra sự cố sạt lở gây chết người.

Theo thống kê sơ bộ, từ Km66+700 - Km117+400 xuất hiện 33 vị trí sạt lở ta luy dương, tổng khối lượng khoảng 22.158m³ đất đá tràn xuống nền, mặt đường.

Nghiêm trọng nhất là Km65+800 gần đèo Khánh Lê với khối đất đá khoảng 12.000m³, chiều dài 100m, rộng 40m, cao 6m, vùi lấp toàn bộ mặt đường.

Nhiều điểm ta luy âm cũng bị khoét hàm ếch: Km84+200 nứt dọc vai đường 40m, hư hỏng hộ lan mềm, nguy cơ sụt nền; Km85+050 sạt ta luy âm, hỏng tường hộ lan 15m; Km81+500 - Km81+550 sạt cách vai đường 1,5m; Km117+450 đ', 0.75, NULL, 'ql 27c - khánh hòa', '8bbe4cb13acc6ab847c77ef7b59bb00d', 'tuoitre.vn', 'https://tuoitre.vn/duong-noi-da-lat-nha-trang-di-qua-deo-khanh-le-tiep-tuc-sat-lo-33-vi-tri-20251123124011313.htm', 'PRESS', '2025-11-26 10:13:35.508622+00', NULL, '2025-12-03 14:55:30.876175+00', NULL, NULL, '0101000020E6100000E3C798BB964C5B40D1915CFE437A2840', NULL, 'ACTIVE', '2025-11-26 10:13:35.508622+00', NULL, NULL);
INSERT INTO public.road_segments (id, created_at, updated_at, segment_name, road_name, province, district, start_lat, start_lon, end_lat, end_lon, status, status_reason, risk_score, hazard_event_id, normalized_name, content_hash, source_domain, source_url, source, verified_at, verified_by, expires_at, legacy_road_event_id, legacy_disruption_id, location, geometry, lifecycle_status, last_verified_at, resolved_at, archived_at) VALUES ('dcc09b2f-b097-4812-9d66-759128218c84', '2025-11-26 14:55:30.981564+00', '2025-11-26 15:09:35.018094+00', 'Đường Mới - Lâm Đồng', 'Đường Mới', 'Lâm Đồng', NULL, 11.5753, 108.1429, NULL, NULL, 'DANGEROUS', 'Vết nứt đã dài hơn và lớn hơn so với chiều 23-11 - Ảnh: NGỌC THÀNH

Sáng 24-11, lực lượng quân đội và chính quyền địa phương tiếp tục tổ chức sơ tán khẩn cấp 20 hộ với 120 dân ở thôn Lạc Thiện 2, xã D’Ran (Lâm Đồng) ra khỏi khu vực chân đồi Trảng Bằng, nơi xuất hiện vết nứt đất khổng lồ khiến 1 quả đồi bị "rách đôi" sau đợt lũ ở khu vực hồ thủy điện Đa Nhim.

Đại tá Lê Anh Vương - Phó chỉ huy trưởng, Tham mưu trưởng Bộ Chỉ huy quân sự tỉnh Lâm Đồng - cho biết từ sáng sớm, các đơn vị chủ lực của Quân khu 7, Bộ Chỉ huy quân sự tỉnh, Trung đoàn bộ binh 994 và Ban Chỉ huy Phòng thủ khu vực 1 - Đức Trọng đã có mặt tại hiện trường, hỗ trợ người dân sơ tán và di dời tài sản.

Trước đó, chiều 23-11, tại xã D’Ran đã ghi nhận vết lún nứt dài hơn 100m, sâu hơn 0,5m trên quả đồi cà phê ở thôn Đường Mới.

Vết nứt cho thấy khả năng sạt trượt đất rất cao, buộc địa phương phải sơ tán các hộ dân phía dưới.

Người dân trong khu vực vùng lũ Đa Nhim di chuyển đồ đạc - Ảnh: NGỌC THÀNH

Đến sáng 24-11, vết ', 0.75, NULL, 'đường mới - lâm đồng', '8489aced7a0cc249ae26ec08810effc9', 'tuoitre.vn', 'https://tuoitre.vn/tiep-tuc-so-tan-khan-cap-dan-song-gan-qua-doi-rach-doi-o-vung-lu-da-nhim-2025112413274008.htm', 'PRESS', '2025-11-26 10:13:28.260202+00', NULL, '2025-12-03 14:55:30.981566+00', NULL, NULL, '0101000020E61000004CA60A4625095B4011C7BAB88D262740', NULL, 'ACTIVE', '2025-11-26 10:13:28.260202+00', NULL, NULL);
INSERT INTO public.road_segments (id, created_at, updated_at, segment_name, road_name, province, district, start_lat, start_lon, end_lat, end_lon, status, status_reason, risk_score, hazard_event_id, normalized_name, content_hash, source_domain, source_url, source, verified_at, verified_by, expires_at, legacy_road_event_id, legacy_disruption_id, location, geometry, lifecycle_status, last_verified_at, resolved_at, archived_at) VALUES ('282a77cf-e923-4ed4-ac02-60a433696979', '2025-11-26 14:55:31.226889+00', '2025-11-26 15:09:35.018094+00', 'Đường ở Nha Trang sau mưa lũ - Khánh Hòa', 'Đường ở Nha Trang sau mưa lũ', 'Khánh Hòa', NULL, 12.2388, 109.1967, NULL, NULL, 'LIMITED', 'Theo ghi nhận của PV Thanh Niên, nhiều ô tô được đưa lên vỉa hè, lòng đường ở Nha Trang (Khánh Hòa) để tránh ngập trong đợt mưa lũ vừa qua vẫn chưa được chủ xe di dời dù nước đã rút. Việc án ngữ này khiến sinh hoạt của người dân bị cản trở, giao thông lộn xộn và công tác vệ sinh môi trường gần như đình trệ.

Xe ô tô để la liệt trên đường Phú Nông, P.Tây Nha Trang khiến giao thông ách tắc nhiều ngày liền ẢNH: H.L

Tại khu vực trước Trạm y tế xã Vĩnh Ngọc cũ (nay thuộc P.Tây Nha Trang), có hơn 10 ô tô nằm ngang, dọc chiếm gần như toàn bộ bề mặt đường, xếp dày kín cả chiều dài đoạn tuyến.

Con đường không rộng, nay chỉ còn một khe nhỏ để xe máy lách qua, khiến giao thông ùn ứ, nhất là vào giờ cao điểm. Người dân bức xúc cho biết, dù nước lũ đã rút từ lâu, đoạn đường này "kẹt như lúc đang chạy lũ", gây mệt mỏi kéo dài nhiều ngày.

Đoạn ngay Trạm y tế xã Vĩnh Ngọc cũ, ô tô nằm ngang, dọc chắn lối đi, gây ách tắc ẢNH: H.L

Trên cầu vượt Ngọc Hội (P.Tây Nha Trang), nhiều ô tô được đưa lên đây', 0.5, NULL, 'đường ở nha trang sau mưa lũ - khánh hòa', '285b1f885dda14ca4950461756a36e0b', 'thanhnien.vn', 'https://thanhnien.vn/o-to-co-thu-tren-cau-duong-o-nha-trang-sau-mua-lu-gay-buc-xuc-185251126090313246.htm', 'PRESS', '2025-11-26 03:29:00+00', NULL, '2025-12-03 14:55:31.226892+00', NULL, NULL, '0101000020E6100000E3C798BB964C5B40D1915CFE437A2840', NULL, 'ACTIVE', '2025-11-26 03:29:00+00', NULL, NULL);
INSERT INTO public.road_segments (id, created_at, updated_at, segment_name, road_name, province, district, start_lat, start_lon, end_lat, end_lon, status, status_reason, risk_score, hazard_event_id, normalized_name, content_hash, source_domain, source_url, source, verified_at, verified_by, expires_at, legacy_road_event_id, legacy_disruption_id, location, geometry, lifecycle_status, last_verified_at, resolved_at, archived_at) VALUES ('c9fe8618-0f62-4575-bdfa-e8c6e11f97ae', '2025-11-26 14:55:31.350746+00', '2025-11-26 15:09:35.018094+00', 'QL 27 - Đắk Lắk', 'QL 27', 'Đắk Lắk', NULL, 12.71, 108.2378, NULL, NULL, 'DANGEROUS', 'Nhiều vết nứt, sạt trượt gây nguy hiểm cho khu dân cư dưới quốc lộ 27 - Ảnh: HOÀNG MINH

Tối 24-11, ông Huỳnh Viết Trung - Chủ tịch UBND xã Hòa Sơn - cho biết địa phương đã gửi báo cáo khẩn về nguy cơ sạt lở tại đồi thôn 4 Yang Reh.

Theo ông Trung, mưa lớn kéo dài những ngày qua khiến quả đồi nằm sát quốc lộ 27 liên tục xuất hiện các vết nứt rộng, đất bị xé toác thành nhiều mảng.

Chiều cùng ngày, quả đồi có dấu hiệu sạt trượt nặng, ảnh hưởng đến an toàn người dân phía ta luy âm cạnh quốc lộ 27.

Phần đất bị trượt đã lấn thêm khoảng 1m so với mức sạt ban đầu, kèm nhiều vết nứt kéo dài, tiềm ẩn nguy cơ sạt lở lớn trong thời gian tới.

Dưới chân đồi có nhiều hộ dân sinh sống, khu vực này lại nằm cạnh tuyến quốc lộ, nên mức độ đe dọa càng tăng.

Nguy cơ sạt lở quả đồi, ảnh hưởng khu dân cư - Ảnh: HOÀNG MINH

Trước diễn biến nguy hiểm, UBND xã đã kiểm tra hiện trường, thông báo và hỗ trợ người dân di dời tạm thời khỏi khu vực có nguy cơ cao. Lực lượng dân quân và công an xã được bố trí tú', 0.75, NULL, 'ql 27 - đắk lắk', 'c3422213fba76be78dd0f03b05ece14e', 'tuoitre.vn', 'https://tuoitre.vn/qua-doi-nut-toac-sat-lo-nhieu-mang-lon-hang-chuc-ho-dan-dak-lak-phai-di-doi-20251124230836258.htm', 'PRESS', '2025-11-26 01:07:50.457133+00', NULL, '2025-12-03 14:55:31.350753+00', NULL, NULL, '0101000020E610000048BF7D1D380F5B40EC51B81E856B2940', NULL, 'ACTIVE', '2025-11-26 01:07:50.457133+00', NULL, NULL);
INSERT INTO public.road_segments (id, created_at, updated_at, segment_name, road_name, province, district, start_lat, start_lon, end_lat, end_lon, status, status_reason, risk_score, hazard_event_id, normalized_name, content_hash, source_domain, source_url, source, verified_at, verified_by, expires_at, legacy_road_event_id, legacy_disruption_id, location, geometry, lifecycle_status, last_verified_at, resolved_at, archived_at) VALUES ('812451d2-0f3b-4b33-a8ad-1ee8476b3393', '2025-11-26 14:55:31.450156+00', '2025-11-26 15:09:35.018094+00', 'Đường vành đai gần 1 - Đà Nẵng', 'Đường vành đai gần 1', 'Đà Nẵng', NULL, 16.0544, 108.2022, NULL, NULL, 'DANGEROUS', 'Sau đợt mưa lớn kéo dài, tuyến đường vành đai phía Tây đoạn qua xã Hòa Vang, TP Đà Nẵng xuất hiện các vị trí sạt lở, đất đá từ sườn đồi tràn xuống mặt đường.', 0.75, NULL, 'đường vành đai gần 1 - đà nẵng', '6ca8ce7b7f02a0aa997923ba57083ee8', 'vietnamnet.vn', 'https://vietnamnet.vn/duong-vanh-dai-gan-1-500-ty-o-da-nang-sat-lo-dat-da-do-xuong-sau-mua-lon-2466436.html', 'PRESS', '2025-11-25 22:01:00+00', NULL, '2025-12-03 14:55:31.450159+00', NULL, NULL, '0101000020E610000014D044D8F00C5B4004E78C28ED0D3040', NULL, 'ACTIVE', '2025-11-25 22:01:00+00', NULL, NULL);
INSERT INTO public.road_segments (id, created_at, updated_at, segment_name, road_name, province, district, start_lat, start_lon, end_lat, end_lon, status, status_reason, risk_score, hazard_event_id, normalized_name, content_hash, source_domain, source_url, source, verified_at, verified_by, expires_at, legacy_road_event_id, legacy_disruption_id, location, geometry, lifecycle_status, last_verified_at, resolved_at, archived_at) VALUES ('de7abb43-fdae-41fd-a221-55eb54dc95ce', '2025-11-26 14:55:31.551528+00', '2025-11-26 15:09:35.018094+00', 'QL 27C - Khánh Hòa', 'QL 27C', 'Khánh Hòa', NULL, 12.2388, 109.1967, NULL, NULL, 'CLOSED', 'Theo báo cáo của các đơn vị quản lý, QL27C qua đèo Khánh Lê, tuyến huyết mạch nối Nha Trang với Đà Lạt, đang trong tình trạng hư hỏng nghiêm trọng. Mặt đường xuất hiện nhiều ổ gà, rạn vỡ, nứt gãy và sình lún với tổng diện tích khoảng 1.500 m².

Các cơ quan chức năng đang khắc phục sạt lở đèo Khánh Lê ẢNH: V.K.

Toàn tuyến ghi nhận 42 điểm sạt lở, khối lượng đất đá tràn xuống đường ước tính 104.530 m³, cùng khoảng 100 cây xanh bị ngã đổ; trong đó 19 điểm gây tắc đường hoàn toàn, chia cắt tuyến suốt nhiều ngày.

Tại tỉnh lộ 9 (kết nối P.Ba Ngòi với H.Khánh Sơn cũ), tình trạng sạt lở taluy âm, taluy dương xuất hiện dày đặc trên đoạn Km 12 - Km 33; riêng Km 10 + 180 bị xói lở đầu cống. Sơ bộ toàn tuyến có 13 điểm sạt lở cần xử lý khẩn cấp.

Phó chủ tịch UBND tỉnh Khánh Hòa Lê Huyền (giữa) kiểm tra thực địa đèo Khánh Lê ẢNH: N.T

Công ty CP Quản lý và xây dựng đường bộ Khánh Hòa đang huy động tối đa máy móc, nhân lực lên tuyến để khắc phục. Tuy nhiên, nhiều điểm bị đứt gãy sâu, lượng đất đá', 0.95, NULL, 'ql 27c - khánh hòa', '5a589aa0b4bea7324b803f1f1a7b8b30', 'thanhnien.vn', 'https://thanhnien.vn/deo-khanh-le-co-42-diem-sat-lo-hon-104000-m-dat-da-tran-xuong-duong-185251125191912717.htm', 'PRESS', '2025-11-25 15:56:00+00', NULL, '2025-12-03 14:55:31.55153+00', NULL, NULL, '0101000020E6100000E3C798BB964C5B40D1915CFE437A2840', NULL, 'ACTIVE', '2025-11-25 15:56:00+00', NULL, NULL);
INSERT INTO public.road_segments (id, created_at, updated_at, segment_name, road_name, province, district, start_lat, start_lon, end_lat, end_lon, status, status_reason, risk_score, hazard_event_id, normalized_name, content_hash, source_domain, source_url, source, verified_at, verified_by, expires_at, legacy_road_event_id, legacy_disruption_id, location, geometry, lifecycle_status, last_verified_at, resolved_at, archived_at) VALUES ('74038a89-ba61-47ac-a2b4-fac7156952de', '2025-11-26 14:55:31.705788+00', '2025-11-26 15:09:35.018094+00', 'Hơn 100 bộ đội cùng lực lượng địa phương đắp bao cát vá đoạn đê vỡ ở Gia Lai (Nghệ An)', NULL, 'Nghệ An', NULL, 18.6792, 105.6811, NULL, NULL, 'DANGEROUS', 'Bộ đội Lữ đoàn 573 đắp bao cát vá đoạn đê bị vỡ - Ảnh: KHẢI ĐĂNG

Thượng tá Dương Tiến Đoàn - Phó chính ủy Lữ đoàn 573 - trực tiếp chỉ huy lực lượng. Bí thư Đảng ủy xã Tuy Phước Lê Thị Vinh Hương cũng có mặt để huy động các lực lượng địa phương gia cố đê.

Theo thông tin từ Lữ đoàn 573, mưa lũ những ngày trước khiến nước sông tại xã Tuy Phước dâng cao.

Ngày 20-11, 200m tuyến đê sông Hà Thanh (thôn Vân Hội) và đê sông Cát (thôn Luật Lễ) bị kéo gãy khiến nước tràn vào gây ngập sâu.

Do mưa lớn, nước dâng cao nên việc vá đê chưa thể thực hiện ở thời điểm đó.

Sáng 25-11, nhận được đề nghị từ chính quyền địa phương, Lữ đoàn 573 huy động lực lượng, phương tiện xuống vá lại tuyến đê bị vỡ.

Bộ đội dùng bao tải đổ cát, đất, đá để vá đê góp phần giảm thiểu thiệt hại cho người dân xung quanh.

Dự kiến tới hết ngày 25-11 việc gia cố đoạn đê vỡ sẽ cơ bản hoàn tất. Các đơn vị đang tiếp tục theo dõi, túc trực để sẵn sàng các phương án.

Bộ đội dàn hàng dọc vá đê ở Tuy Phước sáng 25-11 - Ảnh: KHẢI ', 0.75, NULL, 'hơn 100 bộ đội cùng lực lượng địa phương đắp bao cát vá đoạn đê vỡ ở gia lai (nghệ an)', '98e30edfd9cfea79e11d8d207858ba16', 'tuoitre.vn', 'https://tuoitre.vn/hon-100-bo-doi-cung-luc-luong-dia-phuong-dap-bao-cat-va-doan-de-vo-o-gia-lai-20251125114324102.htm', 'PRESS', '2025-11-25 07:03:29.891651+00', NULL, '2025-12-03 14:55:31.705792+00', NULL, NULL, '0101000020E61000008F537424976B5A4076711B0DE0AD3240', NULL, 'ACTIVE', '2025-11-25 07:03:29.891651+00', NULL, NULL);
INSERT INTO public.road_segments (id, created_at, updated_at, segment_name, road_name, province, district, start_lat, start_lon, end_lat, end_lon, status, status_reason, risk_score, hazard_event_id, normalized_name, content_hash, source_domain, source_url, source, verified_at, verified_by, expires_at, legacy_road_event_id, legacy_disruption_id, location, geometry, lifecycle_status, last_verified_at, resolved_at, archived_at) VALUES ('7e4357cb-bad4-4a8e-ad27-5593bf5cf5ae', '2025-11-26 14:55:32.048322+00', '2025-11-26 15:09:35.018094+00', 'Đường truyền Internet phục vụ các trụ sở làm việc - Khánh Hòa', 'Đường truyền Internet phục vụ các trụ sở làm việc', 'Khánh Hòa', NULL, 12.2388, 109.1967, NULL, NULL, 'DANGEROUS', 'Page Content

Lãnh đạo UBND tỉnh đã kiểm tra thực tế công tác khắc phục tại trạm phát sóng (KHNT75) của Mobifone Khánh Hòa tại phường Tây Nha Trang; trạm phát sóng của Viettel Khánh Hòa tại thôn Nam 1, xã Diên Điền; trạm phát sóng của VNPT Khánh Hòa tại 52 Lý Tự Trọng, xã Diên Khánh. Qua kiểm tra thực tế, các trạm phát sóng đã được kịp thời khắc phục, sửa chữa hư hỏng dù bị thiệt hại nặng do mưa lũ, hoạt động của 3 trạm đều ổn định, các doanh nghiệp đang tiếp tục triển khai phương án dự phòng, đưa hoạt động của các trạm về trạng thái bình thường và ứng phó tốt hơn khi thiên tai xảy ra.

Đồng chí Nguyễn Thanh Hà kiểm tra tại trạm phát sóng của Viettel Khánh Hòa.

Tại buổi làm việc với các doanh nghiệp viễn thông, qua báo cáo sơ bộ, Viettel Khánh Hòa có 150 trạm phát sóng bị ảnh hưởng, trong đó 41 trạm thiệt hại nặng; VNPT Khánh Hòa có 189 trạm bị ảnh hưởng, trong đó 40 trạm thiệt hại nặng; Mobifone Khánh Hòa thiệt hại 150 trạm, trong đó có 27 trạm bị thiệt hại nặng. Đến nay, các nhà mạn', 0.75, NULL, 'đường truyền internet phục vụ các trụ sở làm việc - khánh hòa', '47f4ffabff52b5f2eba9639ede24beb2', 'phongchongthientai.mard.gov.vn', 'https://phongchongthientai.mard.gov.vn/Pages/khanh-hoa-khac-phuc-he-thong-thong-tin-lien-lac-dam-bao-on-dinh-ung-pho-tot-hon-khi-xay--.aspx', 'PRESS', '2025-11-24 13:22:59.847349+00', NULL, '2025-12-03 14:55:32.048324+00', NULL, NULL, '0101000020E6100000E3C798BB964C5B40D1915CFE437A2840', NULL, 'ACTIVE', '2025-11-24 13:22:59.847349+00', NULL, NULL);
INSERT INTO public.road_segments (id, created_at, updated_at, segment_name, road_name, province, district, start_lat, start_lon, end_lat, end_lon, status, status_reason, risk_score, hazard_event_id, normalized_name, content_hash, source_domain, source_url, source, verified_at, verified_by, expires_at, legacy_road_event_id, legacy_disruption_id, location, geometry, lifecycle_status, last_verified_at, resolved_at, archived_at) VALUES ('2ac960e3-e3b3-4bdb-a6d8-57a2fc9b41ca', '2025-11-26 14:55:32.322273+00', '2025-11-26 15:09:35.018094+00', 'Kh&aacute;nh H&ograve;a th&ocirc;ng b&aacute;o khẩn cấp xả lũ 2 hồ chứa (Khánh Hòa)', NULL, 'Khánh Hòa', NULL, 12.2388, 109.1967, NULL, NULL, 'LIMITED', 'Trước tình hình mưa lớn kéo dài, lưu lượng nước đổ về các hồ tăng nhanh, tiềm ẩn nguy cơ mất an toàn công trình, ngày 24.11, Ban Quản lý đầu tư và xây dựng thủy lợi 7 (Ban 7) và Công ty TNHH MTV khai thác công trình thủy lợi Khánh Hòa đã phát đi thông báo khẩn về việc vận hành xả lũ điều tiết hồ Sông Chò 1 và hồ Suối Dầu.

Hồ Sông Chò 1 bắt đầu xả lũ điều tiết từ trưa 24.11

Theo Ban 7, đến 6 giờ 30 phút ngày 24.11, mực nước hồ Sông Chò 1 đạt cao trình +164,0 m, tương đương 84,3% dung tích thiết kế. Lưu vực sông Chò tiếp tục có mưa vừa đến mưa to, lượng mưa 20 - 40 mm/24 giờ, khiến lượng nước về hồ duy trì 70 - 100 m³/giây.

Người dân Nha Trang vẫn chưa hết bàng hoàng sau trận lũ lịch sử vừa qua ẢNH: H.L

Để đảm bảo an toàn đập, Ban 7 triển khai xả điều tiết từ 13 giờ cùng ngày. Lưu lượng xả ban đầu là 50 m³/giây và sẽ tăng dần tùy theo diễn biến thời tiết. Ban ngày (từ 7 - 17 giờ) xả nhiều hơn và giảm lưu lượng vào ban đêm nhằm hạn chế tác động đến vùng hạ du.

Ban 7 cho biết khi mực ', 0.5, NULL, 'kh&aacute;nh h&ograve;a th&ocirc;ng b&aacute;o khẩn cấp xả lũ 2 hồ chứa (khánh hòa)', '51542ee5799f22169960c5fd6da8d2fd', 'thanhnien.vn', 'https://thanhnien.vn/khanh-hoa-thong-bao-khan-cap-xa-lu-2-ho-chua-185251124154400657.htm', 'PRESS', '2025-11-24 09:54:00+00', NULL, '2025-12-03 14:55:32.322276+00', NULL, NULL, '0101000020E6100000E3C798BB964C5B40D1915CFE437A2840', NULL, 'ACTIVE', '2025-11-24 09:54:00+00', NULL, NULL);
INSERT INTO public.road_segments (id, created_at, updated_at, segment_name, road_name, province, district, start_lat, start_lon, end_lat, end_lon, status, status_reason, risk_score, hazard_event_id, normalized_name, content_hash, source_domain, source_url, source, verified_at, verified_by, expires_at, legacy_road_event_id, legacy_disruption_id, location, geometry, lifecycle_status, last_verified_at, resolved_at, archived_at) VALUES ('7a958ad1-ac56-44a8-9226-dd341bfaf8b8', '2025-11-26 14:55:32.420296+00', '2025-11-26 15:09:35.018094+00', 'Đường Đèo Khánh Lê - Khánh Hòa', 'Đường Đèo Khánh Lê', 'Khánh Hòa', NULL, 12.2388, 109.1967, NULL, NULL, 'DANGEROUS', 'Đèo Khánh Lê, Khánh Sơn cùng một số đường, cầu hư hỏng do mưa lũ, hôm nay tỉnh Khánh Hòa công bố tình huống khẩn cấp để khắc phục.', 0.75, NULL, 'đường đèo khánh lê - khánh hòa', 'c8d16e81e1bbc12c86eb7f1723ef5dde', 'vnexpress.net', 'https://vnexpress.net/cong-bo-tinh-huong-khan-cap-sat-lo-deo-khanh-le-va-nhieu-tuyen-duong-4985559.html', 'PRESS', '2025-11-24 09:03:03+00', NULL, '2025-12-03 14:55:32.420298+00', NULL, NULL, '0101000020E6100000E3C798BB964C5B40D1915CFE437A2840', NULL, 'ACTIVE', '2025-11-24 09:03:03+00', NULL, NULL);
INSERT INTO public.road_segments (id, created_at, updated_at, segment_name, road_name, province, district, start_lat, start_lon, end_lat, end_lon, status, status_reason, risk_score, hazard_event_id, normalized_name, content_hash, source_domain, source_url, source, verified_at, verified_by, expires_at, legacy_road_event_id, legacy_disruption_id, location, geometry, lifecycle_status, last_verified_at, resolved_at, archived_at) VALUES ('94c91bcc-0986-49ef-a02a-3fcf89cc83ed', '2025-11-26 14:55:32.567586+00', '2025-11-26 15:09:35.018094+00', 'Đường đi của áp thấp có thể mạnh thành bão sắp vào Biển Đông - Quảng Trị', 'Đường đi của áp thấp có thể mạnh thành bão sắp vào Biển Đông', 'Quảng Trị', NULL, 16.8194, 107.0997, NULL, NULL, 'LIMITED', 'Dự báo đường đi của áp thấp có thể mạnh thành bão sắp vào Biển Đông - Ảnh: JMA

Sáng nay 24-11, hình thái này đang ở cấp áp thấp và hoạt động ngoài khơi Philippines. Thời gian tới áp thấp trên di chuyển hướng tây bắc và có thể mạnh dần lên thành bão, sau đó đổi hướng sang tây và tây nam.

Khoảng ngày 26-11, áp thấp này sẽ vào Biển Đông và có thể đạt cấp bão. Mô hình này cho thấy đợt không khí lạnh sắp tới sẽ ép cơn bão này đi xuống hướng nam khá nhiều.

Theo bà Lê Thị Xuân Lan - chuyên gia khí tượng, mô hình dự báo của Mỹ nhận định từ ngày 26-11 đến 3-12, cơn bão trên có thể hoạt động trên Biển Đông.

Do chịu tác động của không khí lạnh từ phía bắc nên bão sẽ có xu hướng di chuyển hướng tây, sau đó lệch dần tây tây nam, ảnh hưởng đến Nam Trung Bộ.

Mặc dù không khí lạnh không quá mạnh như đợt đang diễn ra, nhưng tổ hợp không khí lạnh, dải hội tụ nhiệt đới và hoàn lưu bão có thể gây ra một đợt mưa lớn.

Hiện cơ quan chức năng đang theo dõi về cơn bão này, người dân cần theo dõi sát để c', 0.4, NULL, 'đường đi của áp thấp có thể mạnh thành bão sắp vào biển đông - quảng trị', '44eede854eacada2eb9057fff856e727', 'tuoitre.vn', 'https://tuoitre.vn/chuyen-gia-va-cac-mo-hinh-du-bao-nhan-dinh-sao-ve-con-bao-co-the-hinh-thanh-o-bien-dong-20251124094926594.htm', 'PRESS', '2025-11-24 04:22:50.784894+00', NULL, '2025-12-03 14:55:32.567588+00', NULL, NULL, '0101000020E610000051DA1B7C61C65A40A857CA32C4D13040', NULL, 'ACTIVE', '2025-11-24 04:22:50.784894+00', NULL, NULL);
INSERT INTO public.road_segments (id, created_at, updated_at, segment_name, road_name, province, district, start_lat, start_lon, end_lat, end_lon, status, status_reason, risk_score, hazard_event_id, normalized_name, content_hash, source_domain, source_url, source, verified_at, verified_by, expires_at, legacy_road_event_id, legacy_disruption_id, location, geometry, lifecycle_status, last_verified_at, resolved_at, archived_at) VALUES ('c836e9b7-023b-49a7-8cf3-9add207f8285', '2025-11-26 14:55:32.813821+00', '2025-11-26 15:09:35.018094+00', 'Rốn lũ Ph&uacute; Y&ecirc;n cũ gượng dậy giữa đổ n&aacute;t sau ngập lụt lịch sử (Đắk Lắk)', NULL, 'Đắk Lắk', NULL, 12.71, 108.2378, NULL, NULL, 'LIMITED', 'Nước r&uacute;t, &#039;rốn ngập&#039; Ph&uacute; Y&ecirc;n cũ (nay thuộc tỉnh Đắk Lắk) hiện ra hoang t&agrave;n: nh&agrave; cửa đổ sập, gia s&uacute;c bị cuốn tr&ocirc;i, t&agrave;i sản hư hỏng. Người d&acirc;n c&ugrave;ng lực lượng địa phương đang khẩn trương dọn dẹp, gượng dậy từng ch&uacute;t để sớm ổn định cuộc sống.', 0.5, NULL, 'rốn lũ ph&uacute; y&ecirc;n cũ gượng dậy giữa đổ n&aacute;t sau ngập lụt lịch sử (đắk lắk)', 'd59e2dbc86814a5a5c648e211e73d627', 'thanhnien.vn', 'https://thanhnien.vn/ron-lu-phu-yen-cu-guong-day-giua-do-nat-sau-ngap-lut-lich-su-185251123175958552.htm', 'PRESS', '2025-11-23 21:35:00+00', NULL, '2025-12-03 14:55:32.813823+00', NULL, NULL, '0101000020E610000048BF7D1D380F5B40EC51B81E856B2940', NULL, 'ACTIVE', '2025-11-23 21:35:00+00', NULL, NULL);
INSERT INTO public.road_segments (id, created_at, updated_at, segment_name, road_name, province, district, start_lat, start_lon, end_lat, end_lon, status, status_reason, risk_score, hazard_event_id, normalized_name, content_hash, source_domain, source_url, source, verified_at, verified_by, expires_at, legacy_road_event_id, legacy_disruption_id, location, geometry, lifecycle_status, last_verified_at, resolved_at, archived_at) VALUES ('0777e4b1-6403-43ca-939b-213e98ffe563', '2025-11-26 14:55:31.926856+00', '2025-11-26 15:14:05.747959+00', 'TIN LŨ TRÊN SÔNG KRÔNG ANA (ĐẮK LẮK), TIN CẢNH BÁO LŨ TRÊN SÔNG KÔN... (Đắk Lắk)', NULL, 'Đắk Lắk', NULL, 12.71, 108.2378, NULL, NULL, 'DANGEROUS', '📍 HIỆN TRẠNG

✅Lũ trên sông Kôn (Gia Lai), sông Krông Ana, sông Srêpôk (Đắk Lắk) đang xuống.

📍 DỰ BÁO VÀ CẢNH BÁO

✅ Trong 12 giờ tới, lũ trên sông Krông Ana tiếp tục xuống và ở trên mức BĐ2

✅ Trong 12-24 giờ tới, lũ trên sông Krông Ana tiếp tục xuống và ở dưới mức BĐ2.



✅Cảnh báo: Trong 24 giờ tới, lũ trên sông Srêpôk (Đắk Lắk) tại trạm Bản Đôn tiép tục xuống và vẫn còn trên mức BĐ3, lũ trên sông Kôn (Gia Lai) dao động ở trên mức BĐ1.

✅Ngập lụt vẫn diễn ra tại tỉnh Đắk Lắk. Nguy cơ xảy ra ngập lụt tại vùng trũng thấp ven sông tỉnh Gia Lai. Nguy cơ xảy ra sạt lở đất trên các sườn dốc các tỉnh Gia Lai, Đắk Lắk.

⚠️ KHUYẾN CÁO

✅ Cảnh báo cấp độ rủi ro thiên tai do lũ:

- Các lưu vực sông tỉnh Đắk Lắk: Cấp 2-3

- Lưu vực sông tỉnh Gia Lai: Cấp 1

✅ Lũ trên sông gây ngập lụt các vùng trũng thấp ven sông, ảnh hưởng tới các hoạt động như giao thông thủy, nuôi trồng thủy sản, sản xuất nông nghiệp, dân sinh và các hoạt động kinh tế- xã hội.



Thời gian ban hành bản tin tiếp theo: 09 giờ', 0.75, NULL, 'tin lũ trên sông krông ana (đắk lắk), tin cảnh báo lũ trên sông kôn... (đắk lắk)', 'e077e4290a316acfb16cbd08af681166', 'phongchongthientai.mard.gov.vn', 'https://phongchongthientai.mard.gov.vn/Pages/tin-lu-tren-song-krong-ana-dak-lak--tin-canh-bao-lu-tren-song-kon-gia-lai-21h-ngay-24-11-2025--.aspx', 'PRESS', '2025-11-24 17:17:52.516702+00', NULL, '2025-12-03 14:55:31.926858+00', NULL, NULL, '0101000020E610000048BF7D1D380F5B40EC51B81E856B2940', NULL, 'ARCHIVED', '2025-11-24 17:17:52.516702+00', NULL, '2025-11-26 15:14:05.747959+00');
INSERT INTO public.road_segments (id, created_at, updated_at, segment_name, road_name, province, district, start_lat, start_lon, end_lat, end_lon, status, status_reason, risk_score, hazard_event_id, normalized_name, content_hash, source_domain, source_url, source, verified_at, verified_by, expires_at, legacy_road_event_id, legacy_disruption_id, location, geometry, lifecycle_status, last_verified_at, resolved_at, archived_at) VALUES ('033a2521-0b36-4dad-b55d-01949c2f06aa', '2025-11-26 14:55:32.174526+00', '2025-11-26 15:14:05.747959+00', 'Thủy điện Đồng Nai 5 phản hồi khi x&atilde; n&oacute;i &#039;kh&ocirc;ng nhận được th&ocirc;ng b&aac (Lâm Đồng)', NULL, 'Lâm Đồng', NULL, 11.5753, 108.1429, NULL, NULL, 'DANGEROUS', 'Theo đó, ông Trần Thanh Hải khẳng định: "Thủy điện Đồng Nai 5 trong thời gian vận hành luôn đảm bảo tuân thủ tuyệt đối quy trình vận hành liên hồ chứa trên lưu vực sông Đồng Nai và đã thông tin, thông báo cho chính quyền địa phương người dân hạ du để nâng cao cảnh giác và có biện pháp phòng ngừa, ứng phó phù hợp.

Ông Hải cho biết các thông báo tăng, giảm lưu lượng xả tràn từ ngày 17 - 24.11, đều được đơn vị gửi đến các cơ quan, đơn vị gồm: Ban Chỉ huy phòng thủ dân sự các tỉnh Lâm Đồng, Đồng Nai; Cục Khí tượng thủy văn; Trung tâm Dự báo khí tượng thủy văn quốc gia; Sở Công thương và Sở Nông nghiệp và Môi trường các tỉnh Lâm Đồng, Đồng Nai; chính quyền địa phương vùng hạ du (Cát Tiên, Cát Tiên 2, Cát Tiên 3, Đạ Tẻh, Bảo Lâm 5, Quảng Tín, Đạ Tẻh 2, Đạ Tẻh 3)…

Thủy điện Đồng Nai 5 xả nước ẢNH: CÔNG TY THỦY ĐIỆN ĐỒNG NAI 5

Cũng theo ông Hải: "Những báo cáo này được gửi qua nhiều kênh thông tin gồm văn bản, email, tin nhắn trong nhóm Zalo phòng chống thiên tai các tỉnh Lâm Đồng và Đồng N', 0.75, NULL, 'thủy điện đồng nai 5 phản hồi khi x&atilde; n&oacute;i &#039;kh&ocirc;ng nhận được th&ocirc;ng b&aac (lâm đồng)', '67e6a5f41d89cfe61b2ff37b207603cf', 'thanhnien.vn', 'https://thanhnien.vn/thuy-dien-dong-nai-5-phan-hoi-khi-xa-noi-khong-nhan-duoc-thong-bao-xa-lu-185251124193921279.htm', 'PRESS', '2025-11-24 13:03:00+00', NULL, '2025-12-03 14:55:32.174528+00', NULL, NULL, '0101000020E61000004CA60A4625095B4011C7BAB88D262740', NULL, 'ARCHIVED', '2025-11-24 13:03:00+00', NULL, '2025-11-26 15:14:05.747959+00');


--
-- Data for Name: traffic_disruptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.traffic_disruptions (id, created_at, updated_at, location, lat, lon, road_geometry, type, severity, road_name, location_description, description, estimated_clearance, alternative_route, starts_at, ends_at, source, verified, is_active, hazard_event_id, media_urls, admin_notes, lifecycle_status, last_verified_at, resolved_at, archived_at) VALUES ('198caffe-8efd-402f-90cd-3bdf651a4de4', '2025-11-19 13:03:01.164403+00', '2025-11-26 15:21:20.121614+00', '0101000020E610000048BF7D1D383F5B401EA7E8482E3F2840', 12.1234, 108.9878, NULL, 'landslide', 'impassable', 'QL27', 'QL27 Km 15, đoạn Nha Trang - Đà Lạt', 'Sạt lở núi, đất đá vùi đường', NULL, NULL, '2025-11-19 13:03:01.164403+00', NULL, 'CSGT', false, true, NULL, NULL, NULL, 'ARCHIVED', '2025-11-19 13:03:01.164403+00', '2025-11-22 13:03:01.164403+00', '2025-11-26 15:21:20.121614+00');


--
-- PostgreSQL database dump complete
--

