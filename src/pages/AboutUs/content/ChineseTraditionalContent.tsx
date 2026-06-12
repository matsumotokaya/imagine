import { Link } from 'react-router-dom';
import { Section } from '../index';

interface ContentProps {
  selectedImage: string | null;
  setSelectedImage: (image: string | null) => void;
}

export function ChineseTraditionalContent({ setSelectedImage }: ContentProps) {
  return (
    <>
      <div className="border-b border-gray-200 pb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">
          你將如何完成它?<br />99%已完成的設計套件，IMAGINE(意象)
        </h2>
        <div className="text-gray-700">
          <p className="mb-4">
            手機壁紙、社群媒體標題、專屬圖示和縮圖。使用"IMAGINE"讓"創作"變得更自由、更簡單。
          </p>
          <p className="mb-4">
            基於融入生成式AI的視覺設計而廣受歡迎的{' '}
            <a
              href="https://www.instagram.com/whatif.ep/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline mx-0.5"
            >
              WHATIF
            </a>
            提供的強大設計資產，只需添加您直觀的"編輯"，即可創造出獨一無二的藝術作品。
          </p>
          <p className="mb-4">
            將靈感變為現實不再需要時間。99%的設計已經為您準備好了。
          </p>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <img
              src="/about-us_001.png"
              alt="IMAGINE 設計樣本 1"
              className="w-full h-auto rounded-lg shadow-md cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setSelectedImage('/about-us_001.png')}
            />
            <img
              src="/about-us_002.png"
              alt="IMAGINE 設計樣本 2"
              className="w-full h-auto rounded-lg shadow-md cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setSelectedImage('/about-us_002.png')}
            />
          </div>

          {/* WHATIF Column */}
          <div className="relative mt-8 overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-200 rounded-full -mr-32 -mt-32 opacity-20"></div>
            <div className="relative p-8">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full blur-md opacity-30"></div>
                  <img
                    src="/avatar_whatif_001.svg"
                    alt="WHATIF 簡介"
                    className="relative w-28 h-28 rounded-full ring-4 ring-white shadow-xl object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">
                    關於WHATIF
                  </h3>
                  <p className="text-gray-700 leading-relaxed mb-6">
                    WHATIF是在Instagram/Threads上擁有超過12萬關注者的創作者。自生成式AI視覺設計初期就開始活動，發布動漫美學、賽博朋克和後啟示錄圖形藝術及視頻。
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <a
                      href="https://www.instagram.com/whatif.ep/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                    >
                      <svg className="w-5 h-5 text-pink-600 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                      <span className="text-sm font-medium text-gray-700">Instagram</span>
                    </a>
                    <a
                      href="https://www.threads.net/@whatif.ep"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                    >
                      <svg className="w-5 h-5 text-gray-800 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 192 192">
                        <path d="M141.537 88.988a66.667 66.667 0 0 0-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.036l13.779 9.452c5.73-8.695 14.723-10.548 21.348-10.548h.229c8.249.053 14.474 2.452 18.503 7.13 2.932 3.405 4.893 8.111 5.864 14.05-7.314-1.243-15.224-1.626-23.68-1.14-23.82 1.371-39.134 15.264-38.105 34.568.522 9.792 5.4 18.216 13.735 23.719 7.047 4.652 16.124 6.927 25.557 6.412 12.458-.683 22.231-5.436 29.049-14.127 5.178-6.6 8.453-15.153 9.899-25.93 5.937 3.583 10.337 8.298 12.767 13.966 4.132 9.635 4.373 25.468-8.546 38.376-11.319 11.308-24.925 16.2-45.488 16.351-22.809-.169-40.06-7.484-51.275-21.742C35.236 139.966 29.808 120.682 29.605 96c.203-24.682 5.63-43.966 16.133-57.317C56.954 24.425 74.204 17.11 97.013 16.94c22.975.17 40.526 7.52 52.171 21.847 5.71 7.026 10.015 15.86 12.853 26.162l16.147-4.308c-3.44-12.68-8.853-23.606-16.219-32.668C147.036 9.607 125.202.195 97.07 0h-.113C68.882.194 47.292 9.642 32.788 28.08 19.882 44.485 13.224 67.315 13.001 95.932L13 96v.067c.224 28.617 6.882 51.447 19.788 67.854C47.292 182.358 68.882 191.806 96.957 192h.113c24.96-.173 42.554-6.708 57.048-21.19 18.963-18.945 18.392-42.692 12.142-57.27-4.484-10.454-11.991-18.842-21.723-24.552Z"/>
                        <path d="M102.378 125.838c-11.315.613-23.712-4.135-24.705-13.768-.531-5.166 1.906-9.925 6.866-13.396 5.025-3.517 11.578-5.253 19.467-5.158 5.89.071 11.507.839 16.678 2.276-1.962 19.569-9.046 29.413-18.306 30.046Z"/>
                      </svg>
                      <span className="text-sm font-medium text-gray-700">Threads</span>
                    </a>
                    <a
                      href="https://whatif-ep.xyz/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                    >
                      <svg className="w-5 h-5 text-indigo-600 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-700">品牌網站</span>
                    </a>
                    <a
                      href="https://whatif.stores.jp/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                    >
                      <svg className="w-5 h-5 text-purple-600 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
                      </svg>
                      <span className="text-sm font-medium text-gray-700">商店</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Section title="主要功能">
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>豐富的範本庫</li>
          <li>直觀的拖放操作</li>
          <li>文字、圖形和圖片的自由排列</li>
          <li>多元素同時編輯功能</li>
          <li>圖像庫(預設+個人庫)</li>
          <li>高解析度PNG匯出</li>
          <li>雲端儲存，可從多個裝置存取</li>
        </ul>
      </Section>

      <Section title="推薦給">
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>想為社群媒體建立視覺內容的個人和企業</li>
          <li>希望高效製作廣告橫幅的行銷人員</li>
          <li>對設計工具操作不熟悉的人</li>
          <li>希望降低設計製作成本的企業主</li>
          <li>想基於範本快速創作的任何人</li>
        </ul>
      </Section>

      <Section title="關於使用IMAGINE創作的內容">
        <p className="text-gray-700 leading-relaxed mb-4">
          IMAGINE提供的所有資產均根據CC0(Creative Commons Zero)授權條款發布。
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li><strong>自由修改:</strong> 替換文字、更改顏色，添加您的1%。</li>
          <li><strong>商業使用:</strong> 可自由用於您的業務、社群媒體或專案。</li>
          <li><strong>鼓勵再分發:</strong> 我們熱烈歡迎分享您的作品。</li>
        </ul>
      </Section>

      <Section title="價格方案">
        <div className="grid md:grid-cols-2 gap-6 mt-6">
          {/* Free Plan */}
          <div className="relative bg-white rounded-2xl border-2 border-gray-200 p-8 hover:shadow-lg transition-shadow duration-300">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Free</h3>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl font-bold text-gray-900">$0</span>
                <span className="text-gray-500">/月</span>
              </div>
            </div>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">基本範本存取</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">PNG匯出</span>
              </li>
            </ul>
          </div>

          {/* Premium Plan */}
          <div className="relative bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-shadow duration-300">
            <div className="absolute top-4 right-4">
              <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full">熱門</span>
            </div>
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-white mb-2">Premium</h3>
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
                <span className="text-white">存取所有高級範本</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-yellow-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white">設計資產庫存取</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-yellow-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white">PNG匯出</span>
              </li>
            </ul>
          </div>
        </div>
      </Section>

      <Section title="透明度與合規性">
        <p className="text-gray-700 leading-relaxed">
          IMAGINE中使用的視覺資產是使用Midjourney等主要圖像生成提供商的工具創建的，這些數據在沒有額外訓練的情況下生成，並根據合約和服務條款進行獨立編輯而製作的，所有資產均獲得商業使用授權。我們的目標是透過結合AI創造力和人工編輯，創造一個任何人都能輕鬆獲得最佳動漫美學設計的世界。
        </p>
      </Section>

      <Section title="運營商資訊">
        <div className="space-y-2">
          <p><strong>運營商</strong>: 松本夏彌(Kaya Matsumoto)</p>
          <p><strong>地址</strong>: 〒221-0003 日本神奈川縣橫濱市神奈川區大口仲町203-40</p>
          <p><strong>電子郵件</strong>: contact@whatif-ep.xyz</p>
        </div>
      </Section>

      <Section title="聯絡我們">
        <p>
          如有任何問題，請透過我們的{' '}
          <Link to="/contact" className="text-blue-600 hover:underline mx-1">
            聯絡頁面
          </Link>
          與我們聯絡。
        </p>
      </Section>
    </>
  );
}
