import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LiveFieldUpdateModal from '../components/LiveFieldUpdateModal'

export default function FieldUpdatePage() {
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(true)

  const handleClose = () => {
    setModalOpen(false)
    navigate(-1)
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <LiveFieldUpdateModal
        isOpen={modalOpen}
        onClose={handleClose}
        onSuccess={() => navigate('/')}
      />
    </div>
  )
}
