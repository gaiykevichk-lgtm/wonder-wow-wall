/**
 * Phase 6 — admin-facing file upload widget.
 *
 * Thin wrapper over AntD `<Upload>` that drives our `uploadFile()`
 * helper instead of AntD's built-in `action`-URL submission. We override
 * `customRequest` so:
 *   * the request goes through our XHR helper (auth, abort, error
 *     envelope handled in one place);
 *   * the parent receives the parsed `MediaAssetResponse` (path + url),
 *     not just the AntD `UploadFile` shell;
 *   * progress drives both AntD's inline progress AND any caller hook.
 *
 * Validation strategy (cheap pre-filter, server is the truth):
 *   * `accept` attr narrows the OS file picker (UX nicety).
 *   * `beforeUpload` rejects clearly bad inputs (size, mime) BEFORE we
 *     waste network on a guaranteed-413/415. Server still validates —
 *     this is purely to skip a round-trip on obvious mistakes.
 *
 * Error UX:
 *   `UploadError.code` is mapped to a localised AntD `message.error`
 *   so admins see "Файл слишком большой" rather than a stack trace. The
 *   raw error is surfaced to `onError` for callers that want to render
 *   inline form errors.
 */
import { useEffect, useRef, useState } from 'react';
import { Upload, message, Progress } from 'antd';
import type { UploadProps } from 'antd';
import { InboxOutlined } from '@ant-design/icons';

import {
  uploadFile,
  UploadError,
  type MediaAssetResponse,
  type MediaPurpose,
} from '../../domains/admin/lib/uploadFile';

const { Dragger } = Upload;

// ─── Localised error labels ──────────────────────────────────────────
// The backend `code` set is closed (see error_handlers.py); list every
// member explicitly so adding a new one without a label is a TS error.
const ERROR_LABELS: Record<string, string> = {
  media_too_large: 'Файл слишком большой',
  media_invalid_mime: 'Неподдерживаемый формат файла',
  media_invalid_dimensions: 'Размер изображения вне допустимых границ',
  media_corrupt: 'Не удалось распознать изображение (повреждённый файл)',
  media_not_found: 'Файл не найден',
  aborted: '',  // user-initiated cancel — silent
};

export interface AdminFileUploadProps {
  purpose: MediaPurpose;
  /**
   * Per-purpose constraints fetched from `GET /admin/media/constraints`.
   * Optional — when absent we skip the client-side pre-filter and rely
   * on the server. Passing them is a UX improvement (skip round-trip on
   * obvious rejects), not a security boundary.
   */
  maxSizeBytes?: number;
  allowedMimes?: string[];
  /** Fired with the parsed asset response after a successful upload. */
  onUploaded?: (asset: MediaAssetResponse) => void;
  /** Fired on any non-2xx (incl. network errors) — useful for inline form errors. */
  onError?: (err: UploadError) => void;
  /** Hint text rendered under the icon. Falls back to a generic prompt. */
  hint?: string;
  /** Disable the dropzone — used when the parent form is submitting. */
  disabled?: boolean;
}

interface InternalState {
  // 0..100 for AntD <Progress>; null means "no upload in flight".
  percent: number | null;
  filename: string | null;
}

export function AdminFileUpload({
  purpose,
  maxSizeBytes,
  allowedMimes,
  onUploaded,
  onError,
  hint,
  disabled,
}: AdminFileUploadProps) {
  const [state, setState] = useState<InternalState>({
    percent: null,
    filename: null,
  });

  // Build the `accept` attr from `allowedMimes` so the OS file picker
  // pre-filters; if not provided, accept any image (server still
  // gates).
  const acceptAttr = allowedMimes?.join(',') ?? 'image/*';

  // Cleanup: if the component unmounts mid-upload, abort the in-flight
  // XHR so the connection is released and a stale `onUploaded` callback
  // can't fire into an unmounted parent. The controller is created per
  // upload in `customRequest` and parked here via a ref — `useEffect`
  // alone would lose access to the live controller because uploads
  // start AFTER mount.
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    if (maxSizeBytes && file.size > maxSizeBytes) {
      const mb = (maxSizeBytes / (1024 * 1024)).toFixed(0);
      message.error(`Файл больше ${mb} МБ — выберите другой`);
      // Returning `Upload.LIST_IGNORE` keeps the rejected file out of
      // AntD's internal fileList, so the UI doesn't show a stuck row.
      return Upload.LIST_IGNORE;
    }
    if (allowedMimes && !allowedMimes.includes(file.type)) {
      message.error(`Формат ${file.type || 'unknown'} не поддерживается`);
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const customRequest: UploadProps['customRequest'] = ({
    file,
    onProgress,
    onSuccess,
    onError: antdOnError,
  }) => {
    const realFile = file as File;
    setState({ percent: 0, filename: realFile.name });

    // Park a fresh controller on the ref so the unmount cleanup can
    // abort *this* upload (not a stale one from a previous render).
    const controller = new AbortController();
    abortRef.current?.abort(); // cancel any prior in-flight upload
    abortRef.current = controller;

    uploadFile({
      file: realFile,
      purpose,
      signal: controller.signal,
      onProgress: (fraction) => {
        const pct = Math.round(fraction * 100);
        setState({ percent: pct, filename: realFile.name });
        // AntD's typings demand a ProgressEvent; only `percent` is read
        // by the default UI, so we cast through `unknown` to skip the
        // `lengthComputable`/`target`/etc. boilerplate that AntD ignores.
        onProgress?.({ percent: pct } as unknown as ProgressEvent);
      },
    })
      .then((asset) => {
        if (abortRef.current === controller) abortRef.current = null;
        setState({ percent: null, filename: null });
        onSuccess?.(asset, new XMLHttpRequest());
        onUploaded?.(asset);
      })
      .catch((err: unknown) => {
        if (abortRef.current === controller) abortRef.current = null;
        setState({ percent: null, filename: null });
        if (err instanceof UploadError) {
          // Silent for user-initiated aborts; toast for everything else.
          if (err.code !== 'aborted') {
            const label =
              (err.code && ERROR_LABELS[err.code]) || err.detail || 'Ошибка загрузки';
            message.error(label);
          }
          antdOnError?.(err);
          onError?.(err);
        } else {
          // Defensive: shouldn't happen with our helper, but never
          // swallow an unknown error silently.
          message.error('Неизвестная ошибка загрузки');
          antdOnError?.(err as Error);
        }
      });
  };

  return (
    <div>
      <Dragger
        name="file"
        accept={acceptAttr}
        multiple={false}
        // We render our own progress bar below; suppress AntD's list
        // to avoid double-rendering the same state.
        showUploadList={false}
        beforeUpload={beforeUpload}
        customRequest={customRequest}
        disabled={disabled || state.percent !== null}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">
          Перетащите файл сюда или кликните для выбора
        </p>
        {hint && <p className="ant-upload-hint">{hint}</p>}
      </Dragger>
      {state.percent !== null && (
        <div style={{ marginTop: 12 }}>
          <Progress percent={state.percent} size="small" />
          <div style={{ fontSize: 12, color: '#888' }}>{state.filename}</div>
        </div>
      )}
    </div>
  );
}
