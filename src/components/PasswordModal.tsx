import { useState, useRef } from "react";
import { Modal, Button, Form } from "react-bootstrap";
import { KeyFill, XLg } from "react-bootstrap-icons";

interface PasswordModalProps {
  show: boolean;
  title?: string;
  onClose: () => void;
  onSubmit: (password: string) => void;
}

const PasswordModal: React.FC<PasswordModalProps> = ({ show, title, onClose, onSubmit }) => {
  const [password, setPassword] = useState("");
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    // Block default submit
    e.preventDefault();

    if (0 < password.trim().length) {
      onSubmit(password);

      // Clear input after submission
      setPassword("");
    }
  };

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>{title || "Password"}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form id="password-modal-form" onSubmit={handleSubmit}>
          <Form.Control
            type="password"
            value={password}
            ref={passwordInputRef}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onClose}>
          <XLg />&nbsp;Cancel
        </Button>
        <Button type="submit" form="password-modal-form" variant="primary">
          <KeyFill />&nbsp;Decrypt
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default PasswordModal;
