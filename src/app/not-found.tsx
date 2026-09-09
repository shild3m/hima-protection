import Link from 'next/link';
import { FaHome } from 'react-icons/fa';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center px-4">
        <p className="text-8xl font-black text-primary mb-4">404</p>
        <h1 className="text-2xl font-bold mb-2">الصفحة غير موجودة</h1>
        <p className="text-text-secondary mb-8">عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.</p>
        <Link href="/" className="btn-primary btn-md inline-flex items-center gap-2">
          <FaHome />
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}
