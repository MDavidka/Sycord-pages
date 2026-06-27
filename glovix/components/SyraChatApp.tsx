'use client'
import { MemoryRouter } from 'react-router-dom';
import { SyraChat } from './SyraChat';

/**
 * Standalone entry-point for the Syra chat UI.
 * Wraps SyraChat in a MemoryRouter so `useNavigate` works when rendered
 * outside the main Glovix App.
 */
export default function SyraChatApp() {
    return (
        <MemoryRouter>
            <SyraChat userInitial="M" />
        </MemoryRouter>
    );
}
