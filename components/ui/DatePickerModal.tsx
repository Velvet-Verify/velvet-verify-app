// components/ui/DatePickerModal.tsx
import React from 'react';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

interface DatePickerModalProps {
  isVisible: boolean;
  mode?: 'date' | 'time' | 'datetime';
  date: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}

export function DatePickerModal({ isVisible, mode = 'date', date, onConfirm, onCancel }: DatePickerModalProps) {
  return (
    <DateTimePickerModal
      isVisible={isVisible}
      mode={mode}
      date={date}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
