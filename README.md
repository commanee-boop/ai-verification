# ACMI AI Verification System

Frontend prototype สำหรับตรวจคุณภาพข้อมูลการบินย้อนหลังและดู replay 3D ใช้ Vue 3 Composition API, TypeScript, Vite, Tailwind CSS, Pinia, Vue Router, CesiumJS, Lucide และ ECharts

## เริ่มใช้งาน

ต้องมี Node.js 18.16+ และ npm (แนะนำ Node LTS ที่ยังได้รับการสนับสนุน) ใช้ Vite 6 เพื่อรองรับ Node ที่ติดตั้งอยู่ในเครื่องนี้

```powershell
cd "D:\Dev program\air_born\ai-verification"
npm.cmd install
npm.cmd run dev
```

เปิด URL ที่ Vite แสดง (ปกติ http://127.0.0.1:5173) ไม่ต้องตั้ง API key หรือ backend

หลังติดตั้ง dependencies และ build แล้ว ดับเบิลคลิก `Run-AI-Verification.cmd` เพื่อเปิด production ที่ http://127.0.0.1:4173/ ตัวเปิดจะตรวจว่าเว็บพร้อมก่อนเปิด browser และรัน server แบบ background ต่อเนื่อง ปิดหน้าต่างตัวเปิดแล้วเว็บยังทำงานอยู่ กดซ้ำจะใช้ server เดิม Log อยู่ใน `.runtime/` โหมดพัฒนาสำหรับแก้โค้ดยังใช้ `npm.cmd run dev` ที่พอร์ต 5173

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

## การใช้งาน

1. หน้าแรกโหลด **SIMULATED DATA** ของ VIPER 01/02 อัตโนมัติ กด Load demo data เพื่อคืนข้อมูลเริ่มต้น
2. แก้ model, callsign, pod และ source ทางซ้าย ข้อมูลจำลองใช้ DCS F-16C เป็น proxy ของ F-16A/B Block 15 OCU พร้อมคำเตือนความแตกต่าง
3. กด Import telemetry / GPS / shot events เพื่อเลือกหรือลากไฟล์เข้า dialog ตรวจ preview แล้ว Confirm import จะแทนที่ข้อมูลประเภทนั้นของอากาศยานที่เลือกทั้งชุด หากมี error จะไม่ commit
4. Play/Pause, Restart, 0.5×–4× และ seek ควบคุมเวลาร่วมกัน กด marker หรือ event ID เพื่อ seek และตรวจหลักฐาน
5. เลือก Follow A/B, Free camera, Top view, Side view หรือ Mission overview หมุน/ซูมด้วยเมาส์ Layers เปิด/ปิดเส้นทาง Settings เปิด/ปิด labels
6. Validate แสดงคุณภาพพร้อมหลักฐานใน 4 analysis tabs; event log ค้นหาและกรอง aircraft ได้
7. Export report ดาวน์โหลด JSON ที่รวม mission provenance, metrics, findings, events และข้อจำกัด
8. Desktop ตรึง Input 300 px / Output 320 px และให้ replay ใช้ความกว้างที่เหลือ แผนที่สูงอย่างน้อย 560 px กราฟ altitude อยู่ใต้สามกรอบ แต่ละ side panel เลื่อนเนื้อหาแยกกันได้ จอเล็กเรียง replay, input และ output แนวตั้ง

ข้อมูลอยู่ใน browser memory เท่านั้น Reload คืน demo Reset ล้าง telemetry/events และคืน configuration ตั้งต้น โดยยังใช้ Flight ID `SIM-026` เพื่อใช้ไฟล์ตัวอย่างได้

## รูปแบบนำเข้า

ไฟล์สูงสุด 10 MB และ 50,000 records UTF-8 CSV (รองรับ quoted fields), JSON array หรือ GPX track points เวลา ISO 8601 ต้องมี `Z` หรือ offset เช่น `2026-01-15T10:00:00+07:00` หน้าจอแสดง UTC ไม่แก้ timestamp offset อัตโนมัติ

| Telemetry field | ข้อกำหนด |
| --- | --- |
| timestamp | จำเป็น; ISO 8601 พร้อม timezone |
| latitude / longitude | จำเป็น; องศา WGS84, ±90 / ±180 |
| altitude | จำเป็น; เมตร ไม่แปลง altitude datum |
| heading | ไม่จำเป็น; 0 ≤ heading < 360 องศา |
| pitch / roll | ไม่จำเป็น; ±90 / ±180 องศา |
| aircraftId / flightId | ไม่จำเป็น; ถ้าระบุต้องตรง aircraft ที่เลือกและ mission |
| source | ไม่จำเป็น; ค่าเริ่มต้นชื่อไฟล์ |

GPX ใช้ `trkpt lat/lon`, `ele`, `time` รองรับ XML namespace ต้องมี altitude/time ทุกจุด Shot events ใช้ CSV/JSON fields `id`, `timestamp`; เพิ่ม `weaponProfile`, `source`, `description`, `aircraftId`, `flightId` ได้ ไม่รับ HIT/MISS ผ่าน importer ห้าม timestamp ซ้ำใน track เดียวหรือ event ID ซ้ำ

ตัวอย่างใน `public/samples/`: `aircraft-a.csv`, `aircraft-b.gpx`, `shot-events.json` ดาวน์โหลดผ่าน `/samples/<filename>` ขณะรันแอป

## Replay และการตรวจสอบ

### มุมมอง debriefing แบบ Tacview

ปรับส่วนกลางตามแนวทางการทบทวนเที่ยวบินในพื้นที่ 3D ของ [Tacview](https://www.tacview.net/product/about/en/) โดยใช้ renderer และ UI ของโปรเจกต์นี้:

- **Analysis / Map**: ค่าเริ่มต้นเป็น Dark Canvas โทน navy/teal จาก OpenStreetMap พร้อมภูมิประเทศ Esri ตามที่เลือกไว้ เปลี่ยนเป็นภาพถ่าย Esri, ถนนสีปกติ, Natural Earth แบบออฟไลน์ หรือ Analysis grid ได้ Dark Canvas เป็น raster ที่ปรับพาเลตด้วย Canvas ไม่ใช่ vector tiles และไม่ใช่การสร้าง water mask
- **Grid / Altitude / Route**: เปิด/ปิดกริด เส้นดิ่งจาก aircraft ลงพื้น และเส้นฉาย trail ลงพื้น เมื่อเปิด terrain เส้นฉายและกริดจะ clamp กับผิวภูมิประเทศ เส้นดิ่งรอค่าความสูง terrain ที่โหลดแล้วเท่านั้น (render offset ป้องกัน z-fighting ไม่ใช่การแก้ telemetry)
- **Trail 30 / 60 / 120 / 300 วินาที**: เส้นสว่างแสดงเฉพาะช่วงก่อน replay cursor ไม่ลากไปอนาคต ช่องว่าง GPS ยังคงตัดเส้น เส้น route จางคือข้อมูลบันทึกทั้งเที่ยวบิน รวมเวลาหลัง cursor มี legend แยกกำกับ
- **3D / Top / Side / Free / Follow A/B**: ปุ่มกล้องใน scene คลิก aircraft หรือ callsign เพื่อเลือก และปุ่ม A/B เพื่อให้กล้องติดตาม
- **Expand**: ขยายเฉพาะ replay พร้อม timeline/play/speed ในจอขยาย กด Esc เพื่อกลับ เมื่อ focus พื้นที่ scene ใช้ Space เล่น/หยุด และลูกศรซ้าย/ขวาเลื่อน ±5 วินาที
- Aircraft ที่ไม่มี heading/pitch/roll ครบจะแสดงเป็น position marker พร้อม `ATTITUDE N/A` ไม่สร้างท่าทางเครื่องบินจากข้อมูล GPS เส้น trail/interpolation เป็นภาพประกอบเท่านั้น

ปุ่ม **3D Terrain** เปิด/ปิดข้อมูลความสูงจาก ArcGIS WorldElevation3D/Terrain3D รายละเอียดขึ้นกับพื้นที่และระดับซูม ไม่ขยายความสูงภูเขาเกินจริง Demo อยู่แถบภาคกลางของประเทศไทยซึ่งหลายบริเวณค่อนข้างราบ ระบบไม่ได้เพิ่มโมเดลอาคารหรือ photogrammetry เมือง และยังไม่มี native Tacview ACMI importer หรือโมดูลของ Tacview

### Modern GIS · Thailand

- เปิดแอปด้วยกล้องเอียงโฟกัสประเทศไทย (100.6°E / 14.7°N, heading 18°, pitch −52°, range 1,800 km) ปุ่ม **TH** กลับมุมนี้; **3D / Mission overview** กลับมาดูเที่ยวบินใกล้ ๆ
- เปิด globe/sun lighting, บรรยากาศแบบ per-fragment, หมอกบาง, soft terrain shadows, HDR เมื่อ GPU รองรับ และ FXAA/MSAA
- ปุ่ม **Cinematic** เปิด/ปิด color grading โทนเย็น, sharpen, vignette บาง, bloom และ terrain shadows เอฟเฟกต์ไม่ใช่ข้อมูลตรวจวัดภูมิศาสตร์ โมเดล aircraft glyph ไม่ทอดเงาขนาดสมมติลงพื้น
- ดวงอาทิตย์อิง UTC timestamp ของ replay ตามค่าเริ่มต้น ปุ่ม **Daylight** เป็น preview แสง 10:00 เวลาไทยในวันที่บันทึก พร้อมป้าย DAYLIGHT PREVIEW ไม่เปลี่ยน telemetry หรือ event timestamps
- ช่อง Terrain source มี **Esri Terrain** เป็นค่าปัจจุบัน และ **World Terrain** สำหรับ Cesium ion เมื่อมี token พร้อมแสดงความสามารถ water mask / vertex normals ของ provider ที่โหลดจริง

### Cesium World Terrain (เมื่อมี token)

คัดลอก `.env.example` เป็น `.env.local` ใส่ `VITE_CESIUM_ION_TOKEN` ของผู้ใช้ แล้ว restart Vite (production ต้อง build ใหม่) จากนั้นเลือก **World Terrain** ในแผนที่ ใช้ token สำหรับ browser แบบ read-only และจำกัด origin/scopes เพราะค่า `VITE_*` อยู่ใน browser bundle ไม่ใช้ administrative token และไม่ส่งค่า token ลงแชต

โค้ดเรียก `createWorldTerrainAsync({ requestWaterMask: true, requestVertexNormals: true })` และเปิด `globe.showWaterEffect` พร้อม bundled ocean normal texture ตาม [Cesium terrain guide](https://cesium.com/learn/cesiumjs-learn/cesiumjs-terrain/). หากยังไม่มี token หรือบริการ World Terrain ล้มเหลว ใช้ Esri terrain พร้อมแจ้งแหล่งจริง ไม่อ้างว่า World Terrain หรือเอฟเฟกต์ water mask ทำงานอยู่

`requestWaterMask` คือขอข้อมูลจาก provider เมื่อมี ไม่รับรอง coverage ทุกแม่น้ำ/ทุกระดับซูม โดยเฉพาะแม่น้ำขนาดเล็ก พื้นผิวน้ำของเจ้าพระยาหรือโขงจะมีเอฟเฟกต์เฉพาะ tile ที่มี mask จริง รุ่น Esri สำรองไม่ใช้ mask/vertex normals ของ Cesium World Terrain

- Cesium ใช้ original low-poly glTF glyph (CC0) ที่สร้างในโปรเจกต์ ไม่ใช่โมเดล F-16 ที่เที่ยงตรง ตำแหน่งและ attitude ที่มีข้อมูลผูกกับ timestamp ภาพขยาย model เพื่อมองเห็นจึงไม่ใช่ขนาดจริง
- Linear interpolation สำหรับภาพระหว่าง samples (มุมใช้ shortest arc) มีป้าย INTERPOLATED และไม่แก้ source records ช่องว่างเกิน 1.5× median cadence จะซ่อน aircraft และแบ่ง path/chart ไม่เชื่อมข้ามช่องว่าง ไม่มี extrapolation
- Demo ยาว 602 วินาที มี 234 positions, 4 shot events, B ขาด 8 samples และเริ่มช้า 2 วินาที ทุก assessment เป็น UNVERIFIED
- Completeness ประมาณจาก median positive interval ภายในขอบเขต track ไม่รับรอง GPS accuracy หรือข้อมูลนอกขอบเขต ความต่างเวลาเริ่มต้นเป็น observation ไม่ใช่หลักฐาน clock drift
- AI Insights เป็น **local deterministic validation rules** พร้อม severity/reason/evidence ไม่เรียกโมเดล AI หรือ API ภายนอก
- **ไม่คำนวณหรืออนุมาน HIT/MISS** และไม่เชื่อ certification flag จาก browser/import การแสดงผลอื่นต้องมี trusted backend ที่พิสูจน์ accreditation และ evidence ได้ ปัจจุบันแสดง UNVERIFIED เสมอ
- ไม่คำนวณจุดยิง วิถีอาวุธ หรือความน่าจะเป็นโจมตี ไม่มีข้อมูลยุทธการจริง

## Cesium และข้อจำกัด

Vite copy `Workers`, `ThirdParty`, `Assets`, `Widgets` ไป `dist/cesium` พร้อม `CESIUM_BASE_URL=/cesium/` ตาม [Cesium Vite guidance](https://cesium.com/blog/2024/02/13/configuring-vite-or-webpack-for-cesiumjs/). ค่าเริ่มต้นใช้ OpenStreetMap ผ่าน Dark Canvas และ ArcGIS WorldElevation3D/Terrain3D โดยไม่ใส่ token ใน public endpoints ที่ทดสอบได้ รายละเอียด/สิทธิ์เข้าถึงขึ้นกับผู้ให้บริการ ต้องมีอินเทอร์เน็ตสำหรับข้อมูลจริง ไม่มี backend ที่ต้องตั้งค่า Cesium ion token จำเป็นเฉพาะเมื่อเลือก World Terrain

แหล่งข้อมูลกำหนดใน `src/services/mapService.ts` ตามเอกสาร [ArcGIS imagery provider](https://cesium.com/learn/cesiumjs/ref-doc/ArcGisMapServerImageryProvider.html) และ [elevation terrain provider](https://cesium.com/learn/cesiumjs/ref-doc/ArcGISTiledElevationTerrainProvider.html). เมื่อ metadata timeout 20 วินาทีหรือเกิด tile errors ซ้ำ ระบบแจ้ง toast และสำรอง Dark Canvas → satellite → OpenStreetMap → bundled Natural Earth → Analysis grid ส่วน terrain ที่โหลดไม่สำเร็จจะกลับเป็น ellipsoid โดยแจ้งสถานะ ไม่อ้างว่าเป็นภูมิประเทศจริง เครดิตผู้ให้บริการแสดงผ่าน Cesium credit display

เฉพาะแผนที่ฐานจริง การฝึกบิน Demo ยังคงเป็น SIMULATED DATA พิกัด/altitude ของ aircraft ไม่ถูกปรับให้เกาะ terrain และไม่คำนวณ AGL ที่รับรองจากภาพ 3D ค่าความสูงคนละ datum ต้อง normalize ที่ source ก่อนใช้งานจริง

Google Fonts เป็น optional network resource มี system fallback ต้องเปิด WebGL/hardware acceleration หาก viewer สร้างไม่ได้แสดง error แต่ยังตรวจข้อมูลได้

Altitude datum อาจต่างกัน ผู้ใช้ต้อง normalize ก่อนนำเข้า ระบบไม่แปลง MSL/ellipsoid Export เป็น JSON (ไม่มี PDF) ไม่อ่าน native DCS ACMI text หรือ binary `.rcd` / `.msnP5`; ต้อง export CSV/JSON/GPX ก่อน ไม่มี ICADS adapter จริง, backend, persistence หรือ authentication

## โครงสร้างและการต่อ API

```text
src/
  components/{layout,aircraft,replay,analysis,common}/
  views/ stores/ services/ composables/ types/ utils/ data/ assets/
public/{samples,models}/
tests/verification.test.ts
scripts/generate-aircraft.mjs
```

`services/missionService.ts` มี interface, mock implementation และ REST adapter แบบ opt-in สำหรับ FastAPI ภายหลัง Adapter ยังไม่ถูกใช้ และ endpoint เป็น contract ที่ต้อง implement จริง ก่อน production ต้องเพิ่ม runtime schema validation, authentication และ trusted simulator evidence verification

Tests ครอบคลุม gaps/offset, invalid coordinates/identity, duplicates, การไม่เชื่อ assessment ปลอม accreditation, interpolation boundaries, CSV/JSON/GPX validation และ store actions (seek, import, reset, load demo)

ตรึง Cesium engine/widgets และ zip.js ใน `overrides` ให้ตรงกับ release ที่ใช้ เพื่อป้องกัน export incompatibility ของ transitive dependencies โปรดคง lockfile เมื่อทำ `npm ci`

## ผลตรวจล่าสุด (12 พฤศจิกายน 2026)

- TypeScript ผ่าน (`vue-tsc --noEmit` ในคำสั่ง build)
- Automated tests ผ่าน 33 กรณี ใน 7 test files รวมการตัด trail ตามเวลา, rewind, GPS gaps, map timeout, การขอ water mask/normals และการแยกเวลา Daylight preview ออกจาก telemetry
- Production build ผ่าน และ copy Cesium assets ทั้ง 4 directories สำเร็จ
- HTTP smoke test ผ่านบน production preview: HTML, JS/CSS chunks, glTF, Cesium worker, Natural Earth tile และ GPX ตัวอย่าง ตอบ 200
- ตรวจ Modern GIS production assets เพิ่มเติม: HTML, JS/CSS, water normal texture และ skybox ตอบ 200; OpenStreetMap tile บริเวณ Demo ตอบ 200 พร้อม CORS สำหรับ Canvas
- ตรวจ public Esri services สำเร็จทั้ง metadata และ tile ภาพถ่าย/ความสูงบริเวณ Demo: HTTP 200 และ `Access-Control-Allow-Origin: *` โดยไม่ใส่ token
- Build ของ Modern GIS ผ่าน มีคำเตือนขนาด Cesium chunk ประมาณ 3.53 MB / gzip 915 KB ซึ่งอาจเพิ่มเวลาโหลดครั้งแรก
- ยังไม่มี ion token ตามที่ผู้ใช้เลือกไว้ จึงใช้ Esri Terrain จริงเป็นค่าเริ่มต้น การเชื่อมต่อ Cesium World Terrain และ coverage ของ water mask ยังไม่ได้ตรวจด้วยบัญชีจริง
- ตรวจ Chrome จริงแล้วพบแท็บล่มด้วย `Out of Memory` แม้เซิร์ฟเวอร์ยังตอบ HTTP 200 จึงปรับเป็น render-on-demand, จำกัด 30 FPS, ลด render resolution ตาม pixel ratio, จำกัด terrain cache/รายละเอียด และปิด cinematic shadows/bloom เป็นค่าเริ่มต้น (เปิดด้วยปุ่ม Cinematic ได้) พร้อมปล่อย ImageBitmap หลังแปลง tile เป็น Canvas

แผนที่เริ่มต้นเป็น Satellite 2D จาก Esri World Imagery (สีภาพจริง) พร้อมเมนูสลับ Dark street map; โหลด Cesium/terrain เมื่อกดเปิด 3D เท่านั้น เพื่อลดความเสี่ยงแท็บ Out of Memory. ตรวจ tile ประเทศไทยตอบ HTTP 200 image/jpeg แล้ว ส่วนเสถียรภาพ WebGL ยังไม่ได้ยืนยันหลังพบแท็บล่มใน Chrome.

ปุ่ม เปิดดาวเทียม 3D จะเปิด Satellite imagery + Esri regional terrain พร้อมมุมเอียงของ Mission overview และ Daylight preview โดยปิด Cinematic ไว้ ภาพถ่ายถูกวางบนความสูงภูมิประเทศจริง ไม่ใช่ photogrammetry mesh ของอาคาร และไม่มีการเปลี่ยนเวลา/ความสูงต้นฉบับของ telemetry.

แก้เส้นทางอัปเดต 3D หลังรายงาน Chrome ล่มเมื่อกด 3D: terrain tile progress อัปเดตเฉพาะ ground references ที่ความสูงเปลี่ยน ไม่สร้าง trail ซ้ำ; coalesce replay geometry เป็น 10 Hz, ไม่สร้าง hidden grid/projections เริ่มต้น, ลดความละเอียด/แคช/เอฟเฟกต์ และสร้าง post-process stage เมื่อเปิด Cinematic เท่านั้น. WebGL context lost/render error จะถอด viewer กลับ 2D และหยุด replay; Chrome heap guard ใช้งานเมื่อมี performance.memory (ไม่ครอบคลุม GPU memory หรือ process ที่ถูกฆ่าทันที). Tests ผ่าน 36 กรณีใน 9 files รวม fallback และ memory guard; ยังต้องตรวจเสถียรภาพ GPU จริง.
