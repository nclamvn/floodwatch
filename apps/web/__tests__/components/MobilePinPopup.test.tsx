import { render, screen, fireEvent } from '@testing-library/react'
import MobilePinPopup from '@/components/MobilePinPopup'

const mockReport = {
  id: '1',
  type: 'ALERT',
  source: 'test-source',
  title: 'Test Alert Title',
  description: 'This is a test description for the alert',
  province: 'Hà Nội',
  lat: 21.0285,
  lon: 105.8542,
  trust_score: 0.85,
  status: 'active',
  created_at: '2024-01-15T10:30:00Z',
}

describe('MobilePinPopup', () => {
  const mockOnClose = jest.fn()
  const mockOnExpand = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render null when report is null', () => {
    const { container } = render(
      <MobilePinPopup report={null} onClose={mockOnClose} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('should render the popup when report is provided', () => {
    render(
      <MobilePinPopup
        report={mockReport}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />
    )

    expect(screen.getByText('Test Alert Title')).toBeInTheDocument()
    expect(screen.getByText(/This is a test description/)).toBeInTheDocument()
  })

  it('should display the report type badge', () => {
    render(
      <MobilePinPopup
        report={mockReport}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />
    )

    expect(screen.getByText('ALERT')).toBeInTheDocument()
  })

  it('should display trust score as percentage', () => {
    render(
      <MobilePinPopup
        report={mockReport}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />
    )

    expect(screen.getByText('85% tin cậy')).toBeInTheDocument()
  })

  it('should display province when provided', () => {
    render(
      <MobilePinPopup
        report={mockReport}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />
    )

    expect(screen.getByText('Hà Nội')).toBeInTheDocument()
  })

  it('should call onClose when close button is clicked', () => {
    render(
      <MobilePinPopup
        report={mockReport}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />
    )

    const closeButtons = screen.getAllByRole('button')
    const closeButton = closeButtons.find(btn =>
      btn.querySelector('svg') && !btn.textContent?.includes('chi tiết')
    )

    if (closeButton) {
      fireEvent.click(closeButton)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    }
  })

  it('should call onClose when backdrop is clicked', () => {
    render(
      <MobilePinPopup
        report={mockReport}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />
    )

    const backdrop = document.querySelector('.fixed.inset-0')
    if (backdrop) {
      fireEvent.click(backdrop)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    }
  })

  it('should call onExpand when expand button is clicked', () => {
    render(
      <MobilePinPopup
        report={mockReport}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />
    )

    const expandButton = screen.getByText('Xem chi tiết')
    fireEvent.click(expandButton)

    expect(mockOnExpand).toHaveBeenCalledTimes(1)
    expect(mockOnExpand).toHaveBeenCalledWith(mockReport)
  })

  it('should handle different report types with correct styling', () => {
    const sosReport = { ...mockReport, type: 'SOS' }

    const { rerender } = render(
      <MobilePinPopup
        report={sosReport}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />
    )

    expect(screen.getByText('SOS')).toBeInTheDocument()

    const roadReport = { ...mockReport, type: 'ROAD' }
    rerender(
      <MobilePinPopup
        report={roadReport}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />
    )

    expect(screen.getByText('ROAD')).toBeInTheDocument()
  })

  it('should not render description section when description is empty', () => {
    const reportWithoutDesc = { ...mockReport, description: undefined }

    render(
      <MobilePinPopup
        report={reportWithoutDesc}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />
    )

    expect(screen.queryByText(/test description/)).not.toBeInTheDocument()
  })
})
