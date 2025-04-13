import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import { useTranslation } from 'react-i18next';
import InputString from './InputString'; // Ajustez le chemin d'importation

interface InputModalProps {
    isOpen: boolean;
    title: string;
    onClose: () => void;
    onConfirm: (value: string) => void;
    confirmButtonColor?: string;
    confirmButtonLabel?: string;
    closeButtonLabel?: string;
    inputPlaceholder?: string;
    defaultValue?: string;
    maxLength?: number;
    type?: 'text' | 'email' | 'number';
    pattern?: string;
    autocompleteChoices?: ({ label: string; value: string } | string)[];
}

const InputModal: React.FC<InputModalProps> = ({
    isOpen,
    title,
    onClose,
    onConfirm,
    confirmButtonColor = 'blue',
    confirmButtonLabel,
    closeButtonLabel,
    defaultValue = '',
    maxLength = 255,
    type = 'text',
    pattern,
    autocompleteChoices = []
}) => {
    const { t } = useTranslation('main');

    const [inputValue, setInputValue] = useState(defaultValue);
    const [isValid, setIsValid] = useState(true);

    useEffect(() => {
        setInputValue(defaultValue as string);
        setIsValid(true);
    }, [isOpen, defaultValue]);

    const handleInputChange = (inputData: { value: any; valid: boolean }) => {
        setInputValue(inputData.value);
        setIsValid(inputData.valid);
    };

    const handleConfirm = (e: React.MouseEvent) => {
        if (isValid) {
            onConfirm(inputValue);
            onClose();
        }
    };

    const handleCancel = (e: React.MouseEvent) => {
        onClose();
    };

    if (!process.env.IS_TESTING) {
        Modal.setAppElement('#app');
    }

    return (
        <Modal
            isOpen={isOpen}
            onRequestClose={handleCancel}
            className="react-modal"
            overlayClassName="react-modal-overlay"
            contentLabel={title}
        >
            <div>
                <div className="center">{title}</div>

                <div className="input-modal-content">
                    <InputString
                        id="modal-input"
                        onValueUpdated={handleInputChange}
                        value={inputValue}
                        maxLength={maxLength}
                        type={type}
                        pattern={pattern}
                        autocompleteChoices={autocompleteChoices}
                    />
                    {!isValid && <div className="apptr__input-error">{t('PleaseEnterValidValue')}</div>}
                </div>

                <div className={'tr__form-buttons-container _center'}>
                    <div className="center">
                        <button className={`button ${confirmButtonColor || 'blue'}`} onClick={handleConfirm} disabled={!isValid}>
                            {confirmButtonLabel || t('Confirm')}
                        </button>
                    </div>
                    <div className="center">
                        <button className="button grey" onClick={handleCancel}>
                            {closeButtonLabel || t('Cancel')}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default InputModal;