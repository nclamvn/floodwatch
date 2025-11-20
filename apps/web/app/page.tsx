import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-white">
      <div className="z-10 max-w-5xl w-full items-center justify-center text-center">
        <h1 className="text-6xl font-bold mb-8 text-slate-900">
          Theo dõi mưa lũ
        </h1>
        <p className="text-2xl mb-8 text-slate-600">
          Hệ thống Giám sát Mưa Lũ Thời gian Thực
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/map"
            className="px-8 py-4 bg-blue-600 text-white rounded-lg text-xl hover:bg-blue-700 transition"
          >
            Xem Bản đồ
          </Link>
          <Link
            href="/routes"
            className="px-8 py-4 bg-green-600 text-white rounded-lg text-xl hover:bg-green-700 transition"
          >
            Tuyến đường An toàn
          </Link>
        </div>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="p-6 border border-slate-200 rounded-lg">
            <h3 className="text-xl font-bold mb-2 text-slate-900">📍 Cảnh báo Realtime</h3>
            <p className="text-slate-600">Nhận cảnh báo mưa lũ từ KTTV và cộng đồng</p>
          </div>
          <div className="p-6 border border-slate-200 rounded-lg">
            <h3 className="text-xl font-bold mb-2 text-slate-900">🛣️ Tuyến đường</h3>
            <p className="text-slate-600">Cập nhật tình trạng giao thông, sạt lở</p>
          </div>
          <div className="p-6 border border-slate-200 rounded-lg">
            <h3 className="text-xl font-bold mb-2 text-slate-900">🆘 Báo cáo Cộng đồng</h3>
            <p className="text-slate-600">Chia sẻ thông tin từ người dân địa phương</p>
          </div>
        </div>
      </div>
    </main>
  )
}
