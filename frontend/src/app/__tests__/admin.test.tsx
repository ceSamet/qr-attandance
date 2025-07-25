import { render, screen } from '@testing-library/react';
import AdminPage from '../admin/page';

describe('AdminPage', () => {
  it('renders admin panel heading', () => {
    render(<AdminPage />);
    expect(screen.getByText('Admin Panel')).toBeInTheDocument();
  });
}); 