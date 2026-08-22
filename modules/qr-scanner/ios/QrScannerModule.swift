import ExpoModulesCore
import VisionKit

public class QrScannerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("QrScanner")

    AsyncFunction("scanQRCode") { (cancelLabel: String, hint: String, promise: Promise) in
      if #available(iOS 16.0, *) {
        Task { @MainActor in
          guard DataScannerViewController.isSupported,
                DataScannerViewController.isAvailable else {
            promise.reject("UNSUPPORTED", "QR scanning is unavailable on this device")
            return
          }
          self.presentScanner(cancelLabel: cancelLabel, hint: hint, promise: promise)
        }
      } else {
        promise.reject("UNSUPPORTED", "QR scanning requires iOS 16 or later")
      }
    }
  }

  @available(iOS 16.0, *)
  @MainActor
  private func presentScanner(cancelLabel: String, hint: String, promise: Promise) {
    guard let rootViewController = UIApplication.shared.connectedScenes
      .compactMap({ $0 as? UIWindowScene })
      .filter({ $0.activationState == .foregroundActive })
      .flatMap({ $0.windows })
      .first(where: { $0.isKeyWindow })?
      .rootViewController else {
      promise.reject("NO_VIEW_CONTROLLER", "Cannot find the active view controller")
      return
    }

    let topViewController = visibleChildViewController(from: rootViewController)

    let scanner = DataScannerViewController(
      recognizedDataTypes: [.barcode(symbologies: [.qr])],
      qualityLevel: .balanced,
      recognizesMultipleItems: false,
      isHighFrameRateTrackingEnabled: false,
      isPinchToZoomEnabled: true,
      isGuidanceEnabled: true,
      isHighlightingEnabled: true
    )
    let coordinator = ScanCoordinator(
      promise: promise,
      scanner: scanner,
      cancelLabel: cancelLabel,
      hint: hint
    )
    scanner.delegate = coordinator
    objc_setAssociatedObject(scanner, "qr-scanner-coordinator", coordinator, .OBJC_ASSOCIATION_RETAIN)
    scanner.modalPresentationStyle = .fullScreen

    topViewController.present(scanner, animated: true) {
      do {
        try scanner.startScanning()
        coordinator.addOverlay()
      } catch {
        coordinator.fail(error)
      }
    }
  }

  @available(iOS 16.0, *)
  @MainActor
  private func visibleChildViewController(from rootViewController: UIViewController) -> UIViewController {
    var topViewController = rootViewController
    while let presented = topViewController.presentedViewController {
      topViewController = presented
    }
    if let navigationController = topViewController as? UINavigationController,
       let visible = navigationController.visibleViewController {
      return visibleChildViewController(from: visible)
    }
    if let tabController = topViewController as? UITabBarController,
       let selected = tabController.selectedViewController {
      return visibleChildViewController(from: selected)
    }
    for child in topViewController.children.reversed()
      where child.viewIfLoaded?.window != nil {
      let visible = visibleChildViewController(from: child)
      if visible.presentedViewController != nil || visible !== child || child.children.isEmpty {
        return visible
      }
    }
    return topViewController
  }
}

@available(iOS 16.0, *)
@MainActor
private final class ScanCoordinator: NSObject, DataScannerViewControllerDelegate {
  private let promise: Promise
  private let scanner: DataScannerViewController
  private let cancelLabel: String
  private let hint: String
  private var completed = false

  init(
    promise: Promise,
    scanner: DataScannerViewController,
    cancelLabel: String,
    hint: String
  ) {
    self.promise = promise
    self.scanner = scanner
    self.cancelLabel = cancelLabel
    self.hint = hint
  }

  func addOverlay() {
    let cancelButton = UIButton(type: .system)
    cancelButton.setTitle(cancelLabel, for: .normal)
    cancelButton.setTitleColor(.white, for: .normal)
    cancelButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
    cancelButton.backgroundColor = UIColor.black.withAlphaComponent(0.48)
    cancelButton.layer.cornerRadius = 18
    cancelButton.addTarget(self, action: #selector(cancel), for: .touchUpInside)
    cancelButton.translatesAutoresizingMaskIntoConstraints = false
    cancelButton.accessibilityLabel = cancelLabel
    scanner.view.addSubview(cancelButton)

    let reticle = UIView()
    reticle.isUserInteractionEnabled = false
    reticle.layer.borderColor = UIColor.white.cgColor
    reticle.layer.borderWidth = 3
    reticle.layer.cornerRadius = 18
    reticle.translatesAutoresizingMaskIntoConstraints = false
    scanner.overlayContainerView.addSubview(reticle)

    let hintLabel = UILabel()
    hintLabel.text = hint
    hintLabel.textColor = .white
    hintLabel.font = .systemFont(ofSize: 15, weight: .medium)
    hintLabel.textAlignment = .center
    hintLabel.numberOfLines = 2
    hintLabel.translatesAutoresizingMaskIntoConstraints = false
    scanner.overlayContainerView.addSubview(hintLabel)

    NSLayoutConstraint.activate([
      cancelButton.topAnchor.constraint(
        equalTo: scanner.view.safeAreaLayoutGuide.topAnchor,
        constant: 12
      ),
      cancelButton.leadingAnchor.constraint(equalTo: scanner.view.leadingAnchor, constant: 20),
      cancelButton.heightAnchor.constraint(equalToConstant: 36),
      cancelButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 64),

      reticle.centerXAnchor.constraint(equalTo: scanner.overlayContainerView.centerXAnchor),
      reticle.centerYAnchor.constraint(
        equalTo: scanner.overlayContainerView.centerYAnchor,
        constant: -30
      ),
      reticle.widthAnchor.constraint(equalToConstant: 240),
      reticle.heightAnchor.constraint(equalToConstant: 240),

      hintLabel.centerXAnchor.constraint(equalTo: scanner.overlayContainerView.centerXAnchor),
      hintLabel.leadingAnchor.constraint(
        greaterThanOrEqualTo: scanner.overlayContainerView.leadingAnchor,
        constant: 24
      ),
      hintLabel.trailingAnchor.constraint(
        lessThanOrEqualTo: scanner.overlayContainerView.trailingAnchor,
        constant: -24
      ),
      hintLabel.topAnchor.constraint(equalTo: reticle.bottomAnchor, constant: 24),
    ])
  }

  @objc private func cancel() {
    finish(with: nil)
  }

  func fail(_ error: Error) {
    guard !completed else { return }
    completed = true
    scanner.stopScanning()
    scanner.dismiss(animated: true) {
      self.promise.reject("START_FAILED", error.localizedDescription)
    }
  }

  private func finish(with value: String?) {
    guard !completed else { return }
    completed = true
    scanner.stopScanning()
    scanner.dismiss(animated: true) {
      self.promise.resolve(value)
    }
  }

  private func resolve(_ items: [RecognizedItem]) {
    for item in items {
      if case .barcode(let barcode) = item, let value = barcode.payloadStringValue {
        finish(with: value)
        return
      }
    }
  }

  func dataScanner(
    _ dataScanner: DataScannerViewController,
    didAdd addedItems: [RecognizedItem],
    allItems: [RecognizedItem]
  ) {
    resolve(addedItems)
  }

  func dataScanner(_ dataScanner: DataScannerViewController, didTapOn item: RecognizedItem) {
    resolve([item])
  }

  nonisolated func dataScannerDidCancel(_ dataScanner: DataScannerViewController) {
    Task { @MainActor in
      finish(with: nil)
    }
  }
}
