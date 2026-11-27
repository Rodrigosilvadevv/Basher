import { useRef } from 'react';

// Botão que abre a galeria/câmera. No iPhone o input já oferece "Tirar foto".
export default function FilePick({ onFiles, multiple, accept = 'image/*', children, className = '', disabled, ariaLabel }) {
  const ref = useRef(null);
  return (
    <>
      <button type="button" className={className} onClick={() => ref.current?.click()} disabled={disabled} aria-label={ariaLabel}>
        {children}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          const files = [...(e.target.files || [])];
          e.target.value = '';
          if (files.length) onFiles(multiple ? files : files[0]);
        }}
      />
    </>
  );
}
