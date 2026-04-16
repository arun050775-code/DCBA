import { Construction } from 'lucide-react'

export default function ComingSoon({ title }) {
  return (
    <div className="p-6 flex items-center justify-center min-h-96">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Construction className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-700 mb-2">{title}</h2>
        <p className="text-gray-400 text-sm">This module is being built. Coming soon!</p>
      </div>
    </div>
  )
}
