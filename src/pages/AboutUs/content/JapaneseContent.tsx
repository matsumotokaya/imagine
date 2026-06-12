import { Link } from 'react-router-dom';

interface ContentProps {
  selectedImage: string | null;
  setSelectedImage: (image: string | null) => void;
}

export function JapaneseContent({ setSelectedImage }: ContentProps) {
  return (
    <>
      {/* Hero */}
      <div className="text-center">
        <p className="text-sm font-medium tracking-widest text-purple-600 uppercase mb-4">
          Design Tool by WHATIF
        </p>
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-4">
          {'\u3042\u306A\u305F\u306F\u3069\u3046\u5B8C\u6210\u3055\u305B\u308B\uFF1F'}
          <br />
          <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
            99%{'\u5B8C\u6210\u6E08\u307F\u30C7\u30B6\u30A4\u30F3\u30AD\u30C3\u30C8\u3001'}IMAGINE({'\u30A4\u30DE\u30B8\u30F3'})
          </span>
        </h2>
        <div className="text-gray-600 max-w-2xl mx-auto leading-relaxed mb-8 space-y-4">
          <p>
            {'\u30B9\u30DE\u30DB\u306E\u58C1\u7D19\u3001SNS\u306E\u30D8\u30C3\u30C0\u30FC\u3001\u81EA\u5206\u5C02\u7528\u306E\u30A2\u30A4\u30B3\u30F3\u3084\u30B5\u30E0\u30CD\u30A4\u30EB\u3002\u201C'}IMAGINE{'\u201D\u3067\u300C\u4F5C\u308B\u300D\u3092\u3001\u3082\u3063\u3068\u81EA\u7531\u306B\u3001\u3082\u3063\u3068\u7C21\u5358\u306B\u3002'}
          </p>
          <p>
            {'\u751F\u6210'}AI{'\u3092\u53D6\u308A\u5165\u308C\u305F\u30D3\u30B8\u30E5\u30A2\u30EB\u30C7\u30B6\u30A4\u30F3\u3067\u4EBA\u6C17\u306E'}
            <a
              href="https://www.instagram.com/whatif.ep/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-600 hover:underline font-medium mx-0.5"
            >
              WHATIF
            </a>
            {'\u304C\u63D0\u4F9B\u3059\u308B\u5727\u5012\u7684\u306A\u30C7\u30B6\u30A4\u30F3\u30A2\u30BB\u30C3\u30C8\u3092\u30D9\u30FC\u30B9\u306B\u3001\u3042\u306A\u305F\u306E\u76F4\u611F\u7684\u306A\u300C\u30A8\u30C7\u30A3\u30C3\u30C8\u300D\u3092\u52A0\u3048\u308B\u3060\u3051\u3067\u3001\u4E16\u754C\u306B\u4E00\u3064\u3060\u3051\u306E\u30A2\u30FC\u30C8\u304C\u751F\u307E\u308C\u307E\u3059\u3002'}
          </p>
          <p>
            {'\u30A4\u30F3\u30B9\u30D4\u30EC\u30FC\u30B7\u30E7\u30F3\u3092\u5F62\u306B\u3059\u308B\u306E\u306B\u3001\u3082\u3046\u6642\u9593\u306F\u304B\u304B\u308A\u307E\u305B\u3093\u3002\u30C7\u30B6\u30A4\u30F3\u306E'}99%{'\u306F\u65E2\u306B\u7528\u610F\u3055\u308C\u3066\u3044\u307E\u3059\u3002'}
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-full shadow-lg shadow-purple-200 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
        >
          {'\u7121\u6599\u3067\u59CB\u3081\u308B'}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>

      {/* Gallery */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {['/about-us_001.png', '/about-us_002.png', '/about-us_003.png', '/about-us_004.png'].map((src, i) => (
          <div key={i} className="aspect-[3/2] bg-gray-100 rounded-xl overflow-hidden">
            <img
              src={src}
              alt={`IMAGINE design sample ${i + 1}`}
              className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-500"
              onClick={() => setSelectedImage(src)}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        ))}
      </div>

      {/* Features */}
      <div>
        <h3 className="text-2xl font-bold text-gray-900 text-center mb-8">
          {'\u4E3B\u306A\u6A5F\u80FD'}
        </h3>
        <div className="grid md:grid-cols-3 gap-5">
          <FeatureCard
            title={'\u8C4A\u5BCC\u306A\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8'}
            description={'\u30D7\u30ED\u54C1\u8CEA\u306E\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u304B\u3089\u9078\u3093\u3067\u3001\u3059\u3050\u306B\u5236\u4F5C\u958B\u59CB'}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            }
          />
          <FeatureCard
            title={'\u30C9\u30E9\u30C3\u30B0\uFF06\u30C9\u30ED\u30C3\u30D7'}
            description={'\u76F4\u611F\u7684\u306A\u64CD\u4F5C\u3067\u8AB0\u3067\u3082\u7C21\u5358\u306B\u30C7\u30B6\u30A4\u30F3'}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            }
          />
          <FeatureCard
            title={'\u81EA\u7531\u306A\u30EC\u30A4\u30A2\u30A6\u30C8'}
            description={'\u30C6\u30AD\u30B9\u30C8\u3001\u56F3\u5F62\u3001\u753B\u50CF\u3092\u81EA\u7531\u306B\u914D\u7F6E\u30FB\u7DE8\u96C6'}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0L12 17.25 6.429 14.25m0 0L2.25 16.5l9.75 5.25 9.75-5.25-4.179-2.25" />
              </svg>
            }
          />
          <FeatureCard
            title={'\u753B\u50CF\u30E9\u30A4\u30D6\u30E9\u30EA'}
            description={'\u30C7\u30D5\u30A9\u30EB\u30C8\u30A2\u30BB\u30C3\u30C8\uFF0B\u500B\u4EBA\u30E9\u30A4\u30D6\u30E9\u30EA\u3067\u7D20\u6750\u7BA1\u7406'}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
            }
          />
          <FeatureCard
            title={'\u9AD8\u89E3\u50CF\u5EA6\u51FA\u529B'}
            description={'PNG\u5F62\u5F0F\u3067\u9AD8\u54C1\u8CEA\u306A\u30C7\u30FC\u30BF\u3092\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9'}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            }
          />
          <FeatureCard
            title={'\u30AF\u30E9\u30A6\u30C9\u4FDD\u5B58'}
            description={'\u8907\u6570\u30C7\u30D0\u30A4\u30B9\u304B\u3089\u30A2\u30AF\u30BB\u30B9\u3001\u81EA\u52D5\u4FDD\u5B58\u3067\u5B89\u5FC3'}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
              </svg>
            }
          />
        </div>
      </div>

      {/* WHATIF */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 shadow-lg hover:shadow-xl transition-shadow duration-300">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-200 rounded-full -mr-32 -mt-32 opacity-20"></div>
        <div className="relative p-8">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full blur-md opacity-30"></div>
              <img
                src="/avatar_whatif_001.svg"
                alt="WHATIF profile"
                className="relative w-28 h-28 rounded-full ring-4 ring-white shadow-xl object-cover"
              />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">
                WHATIF{'\u306B\u3064\u3044\u3066'}
              </h3>
              <p className="text-gray-700 leading-relaxed mb-6">
                WHATIF{'\u3068\u306F'}Instagram/Threads{'\u306B\u3066'}12{'\u4E07\u4EBA\u4EE5\u4E0A\u306E\u30D5\u30A9\u30ED\u30EF\u30FC\u3092\u8981\u3059\u308B\u30AF\u30EA\u30A8\u30A4\u30BF\u30FC\u3002\u751F\u6210'}AI{'\u306B\u3088\u308B\u30D3\u30B8\u30E5\u30A2\u30EB\u30C7\u30B6\u30A4\u30F3\u9ECE\u660E\u671F\u304B\u3089\u6D3B\u52D5\u3057\u3001\u30A2\u30CB\u30E1\u30A8\u30B9\u30C6\u30C6\u30A3\u30C3\u30AF\u3001\u30B5\u30A4\u30D0\u30FC\u30D1\u30F3\u30AF\u3001\u30DD\u30B9\u30C8\u30A2\u30DD\u30AB\u30EA\u30D7\u30C6\u30A3\u30C3\u30AF\u306A\u30B0\u30E9\u30D5\u30A3\u30C3\u30AF\u30A2\u30FC\u30C8\u3084\u52D5\u753B\u3092\u6295\u7A3F\u3057\u3066\u3044\u308B\u3002'}
              </p>
              <div className="flex flex-wrap gap-3">
                <a href="https://www.instagram.com/whatif.ep/" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
                  <svg className="w-5 h-5 text-pink-600 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Instagram</span>
                </a>
                <a href="https://www.threads.net/@whatif.ep" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
                  <svg className="w-5 h-5 text-gray-800 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 192 192">
                    <path d="M141.537 88.988a66.667 66.667 0 0 0-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.036l13.779 9.452c5.73-8.695 14.723-10.548 21.348-10.548h.229c8.249.053 14.474 2.452 18.503 7.13 2.932 3.405 4.893 8.111 5.864 14.05-7.314-1.243-15.224-1.626-23.68-1.14-23.82 1.371-39.134 15.264-38.105 34.568.522 9.792 5.4 18.216 13.735 23.719 7.047 4.652 16.124 6.927 25.557 6.412 12.458-.683 22.231-5.436 29.049-14.127 5.178-6.6 8.453-15.153 9.899-25.93 5.937 3.583 10.337 8.298 12.767 13.966 4.132 9.635 4.373 25.468-8.546 38.376-11.319 11.308-24.925 16.2-45.488 16.351-22.809-.169-40.06-7.484-51.275-21.742C35.236 139.966 29.808 120.682 29.605 96c.203-24.682 5.63-43.966 16.133-57.317C56.954 24.425 74.204 17.11 97.013 16.94c22.975.17 40.526 7.52 52.171 21.847 5.71 7.026 10.015 15.86 12.853 26.162l16.147-4.308c-3.44-12.68-8.853-23.606-16.219-32.668C147.036 9.607 125.202.195 97.07 0h-.113C68.882.194 47.292 9.642 32.788 28.08 19.882 44.485 13.224 67.315 13.001 95.932L13 96v.067c.224 28.617 6.882 51.447 19.788 67.854C47.292 182.358 68.882 191.806 96.957 192h.113c24.96-.173 42.554-6.708 57.048-21.19 18.963-18.945 18.392-42.692 12.142-57.27-4.484-10.454-11.991-18.842-21.723-24.552Z"/>
                    <path d="M102.378 125.838c-11.315.613-23.712-4.135-24.705-13.768-.531-5.166 1.906-9.925 6.866-13.396 5.025-3.517 11.578-5.253 19.467-5.158 5.89.071 11.507.839 16.678 2.276-1.962 19.569-9.046 29.413-18.306 30.046Z"/>
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Threads</span>
                </a>
                <a href="https://whatif-ep.xyz/" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
                  <svg className="w-5 h-5 text-indigo-600 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Brand Site</span>
                </a>
                <a href="https://whatif.stores.jp/" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
                  <svg className="w-5 h-5 text-purple-600 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Shop</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Target Audience */}
      <div>
        <h3 className="text-2xl font-bold text-gray-900 text-center mb-6">
          {'\u3053\u3093\u306A\u65B9\u306B\u304A\u3059\u3059\u3081'}
        </h3>
        <div className="flex flex-wrap justify-center gap-3">
          {[
            'SNS\u6295\u7A3F\u7528\u306E\u30D3\u30B8\u30E5\u30A2\u30EB\u3092\u4F5C\u308A\u305F\u3044\u65B9',
            '\u5E83\u544A\u30D0\u30CA\u30FC\u3092\u52B9\u7387\u7684\u306B\u5236\u4F5C\u3057\u305F\u3044\u30DE\u30FC\u30B1\u30BF\u30FC',
            '\u30C7\u30B6\u30A4\u30F3\u30C4\u30FC\u30EB\u306E\u64CD\u4F5C\u304C\u82E6\u624B\u306A\u65B9',
            '\u30B3\u30B9\u30C8\u3092\u629C\u3048\u3066\u30C7\u30B6\u30A4\u30F3\u5236\u4F5C\u3057\u305F\u3044\u4E8B\u696D\u8005',
            '\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u30D9\u30FC\u30B9\u3067\u7D20\u65E9\u304F\u5236\u4F5C\u3057\u305F\u3044\u65B9',
          ].map((text, i) => (
            <span key={i} className="px-4 py-2.5 bg-purple-50 text-purple-700 rounded-full text-sm font-medium border border-purple-100">
              {text}
            </span>
          ))}
        </div>
      </div>

      {/* CC0 License */}
      <div>
        <h3 className="text-2xl font-bold text-gray-900 text-center mb-2">
          {'\u5236\u4F5C\u7269\u306B\u3064\u3044\u3066'}
        </h3>
        <p className="text-center text-gray-500 mb-8 text-sm">
          {'\u5168\u3066\u306E\u30A2\u30BB\u30C3\u30C8\u306F'}CC0 (Creative Commons Zero) {'\u30E9\u30A4\u30BB\u30F3\u30B9\u3067\u63D0\u4F9B\u3055\u308C\u3066\u3044\u307E\u3059'}
        </p>
        <div className="grid md:grid-cols-3 gap-5">
          <LicenseCard
            title={'\u6539\u5909\u81EA\u7531'}
            description={'\u6587\u5B57\u3092\u5165\u308C\u66FF\u3048\u3001\u8272\u3092\u5857\u308A\u66FF\u3048\u3001\u3042\u306A\u305F\u306E1%\u3092\u52A0\u3048\u3066\u304F\u3060\u3055\u3044\u3002'}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
              </svg>
            }
          />
          <LicenseCard
            title={'\u5546\u7528\u5229\u7528OK'}
            description={'\u3042\u306A\u305F\u306E\u30D3\u30B8\u30CD\u30B9\u3001SNS\u3001\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u306B\u5236\u9650\u306A\u304F\u6D3B\u7528\u3067\u304D\u307E\u3059\u3002'}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
              </svg>
            }
          />
          <LicenseCard
            title={'\u518D\u914D\u5E03\u63A8\u5968'}
            description={'\u3042\u306A\u305F\u306E\u6210\u679C\u3092\u5E83\u3081\u308B\u305F\u3081\u306E\u30B7\u30A7\u30A2\u3092\u3001\u5168\u529B\u3067\u6B53\u8FCE\u3057\u307E\u3059\u3002'}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
            }
          />
        </div>
      </div>

      {/* Pricing */}
      <div>
        <h3 className="text-2xl font-bold text-gray-900 text-center mb-8">
          {'\u6599\u91D1\u30D7\u30E9\u30F3'}
        </h3>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Free Plan */}
          <div className="relative bg-white rounded-2xl border-2 border-gray-200 p-8 hover:shadow-lg transition-shadow duration-300">
            <div className="text-center mb-6">
              <h4 className="text-2xl font-bold text-gray-900 mb-2">Free</h4>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl font-bold text-gray-900">&yen;0</span>
                <span className="text-gray-500">/月</span>
              </div>
            </div>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">{'\u57FA\u672C\u7684\u306A\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u5229\u7528'}</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">PNG{'\u51FA\u529B'}</span>
              </li>
            </ul>
          </div>

          {/* Premium Plan */}
          <div className="relative bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-shadow duration-300">
            <div className="absolute top-4 right-4">
              <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full">{'\u4EBA\u6C17'}</span>
            </div>
            <div className="text-center mb-6">
              <h4 className="text-2xl font-bold text-white mb-2">Premium</h4>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl font-bold text-white">$3</span>
                <span className="text-purple-200">/月</span>
              </div>
            </div>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-yellow-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white">{'\u5168\u3066\u306E\u30D7\u30EC\u30DF\u30A2\u30E0\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u5229\u7528'}</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-yellow-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white">{'\u30C7\u30B6\u30A4\u30F3\u30A2\u30BB\u30C3\u30C8\u30E9\u30A4\u30D6\u30E9\u30EA\u306E\u5229\u7528'}</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-yellow-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white">PNG{'\u51FA\u529B'}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Transparency */}
      <div className="rounded-xl bg-gray-50 p-6 md:p-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          Transparency &amp; Compliance
        </h3>
        <p className="text-sm text-gray-600 leading-relaxed">
          IMAGINE{'\u3067\u4F7F\u7528\u3055\u308C\u308B\u30D3\u30B8\u30E5\u30A2\u30EB\u30A2\u30BB\u30C3\u30C8\u306F\u3001'}Midjourney{'\u7B49\u306E\u5927\u624B\u753B\u50CF\u751F\u6210\u4E8B\u696D\u8005\u306B\u3088\u308B\u30C4\u30FC\u30EB\u3092\u7528\u3044\u3066\u3001\u8FFD\u52A0\u5B66\u7FD2\u7121\u3057\u3067\u751F\u6210\u3055\u308C\u305F\u30C7\u30FC\u30BF\u3092\u5143\u306B\u3001\u5951\u7D04\u3068\u5229\u7528\u898F\u7D04\u306B\u57FA\u3065\u304D\u3001\u72EC\u81EA\u306E\u7DE8\u96C6\u3092\u7D4C\u3066\u5236\u4F5C\u3055\u308C\u305F\u3082\u306E\u3067\u3042\u308A\u3001\u5168\u3066\u5546\u7528\u5229\u7528\u304C\u8A31\u53EF\u3055\u308C\u3066\u3044\u308B\u3082\u306E\u3067\u3059\u3002\u79C1\u305F\u3061\u306F'}AI{'\u306E\u5275\u9020\u6027\u3068\u4EBA\u9593\u306E\u7DE8\u96C6\u3092\u7D44\u307F\u5408\u308F\u305B\u308B\u3053\u3068\u3067\u3001\u8AB0\u3082\u304C\u624B\u8EFD\u306B\u6700\u9AD8\u306E\u30A2\u30CB\u30E1\u30FB\u30A8\u30B9\u30C6\u30C6\u30A3\u30C3\u30AF\u3092\u624B\u306B\u3067\u304D\u308B\u4E16\u754C\u3092\u76EE\u6307\u3057\u3066\u3044\u307E\u3059\u3002'}
        </p>
      </div>

      {/* Contact CTA */}
      <div className="text-center rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 py-10 px-6">
        <h3 className="text-xl font-bold text-white mb-3">
          {'\u3054\u8CEA\u554F\u306F\u3042\u308A\u307E\u3059\u304B\uFF1F'}
        </h3>
        <p className="text-purple-200 mb-6">
          {'\u304A\u6C17\u8EFD\u306B\u304A\u554F\u3044\u5408\u308F\u305B\u304F\u3060\u3055\u3044'}
        </p>
        <Link
          to="/contact"
          className="inline-flex items-center gap-2 px-6 py-3 bg-white text-purple-600 rounded-full font-semibold hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
        >
          {'\u304A\u554F\u3044\u5408\u308F\u305B'}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>
    </>
  );
}

// --- Sub-components ---

function FeatureCard({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="group p-5 rounded-xl border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all duration-200">
      <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-3 group-hover:bg-purple-100 transition-colors">
        {icon}
      </div>
      <h4 className="font-semibold text-gray-900 mb-1">{title}</h4>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}

function LicenseCard({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="text-center p-6 rounded-xl bg-gradient-to-b from-purple-50 to-white border border-purple-100">
      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
        {icon}
      </div>
      <h4 className="font-bold text-gray-900 mb-2">{title}</h4>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}
