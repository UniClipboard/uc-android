import UIKit

private final class KeyboardImageEdgeShadeView: UIView {
    private let gradient = CAGradientLayer()

    override init(frame: CGRect) {
        super.init(frame: frame)
        isUserInteractionEnabled = false
        accessibilityIdentifier = "keyboard.imageEdgeShade"
        gradient.colors = [
            UIColor.black.withAlphaComponent(0.16).cgColor,
            UIColor.clear.cgColor,
            UIColor.clear.cgColor,
            UIColor.black.withAlphaComponent(0.16).cgColor,
        ]
        gradient.locations = [0, 0.24, 0.76, 1]
        layer.addSublayer(gradient)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layoutSubviews() {
        super.layoutSubviews()
        gradient.frame = bounds
    }
}

@MainActor
final class KeyboardCardCell: UICollectionViewCell {
    static let reuseIdentifier = "KeyboardCardCell"

    private let headerStack = UIStackView()
    private let kindIcon = UIImageView()
    private let kindLabel = UILabel()
    private let timeLabel = UILabel()
    private let activity = UIActivityIndicatorView(style: .medium)
    private let titleLabel = UILabel()
    private let subtitleLabel = UILabel()
    private let imageView = UIImageView()
    private let imagePlaceholderView = UIImageView()
    private let imageEdgeShadeView = KeyboardImageEdgeShadeView()
    private let actedOverlay = UIView()
    private let actedIcon = UIImageView()
    private var thumbnailTask: Task<Void, Never>?
    private var representedID: UUID?
    private var thumbnailRequest: KeyboardThumbnailRequest?

    override init(frame: CGRect) {
        super.init(frame: frame)
        contentView.backgroundColor = KeyboardSurface.itemUIColor
        contentView.layer.cornerRadius = 18
        contentView.layer.cornerCurve = .continuous
        contentView.clipsToBounds = true

        headerStack.axis = .horizontal
        headerStack.spacing = 5
        headerStack.alignment = .center
        headerStack.translatesAutoresizingMaskIntoConstraints = false
        kindIcon.contentMode = .scaleAspectFit
        kindIcon.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 11, weight: .bold)
        kindIcon.widthAnchor.constraint(equalToConstant: 13).isActive = true
        kindLabel.font = .preferredFont(forTextStyle: .caption1).withWeight(.semibold)
        timeLabel.font = .preferredFont(forTextStyle: .caption2)
        timeLabel.textColor = .tertiaryLabel
        activity.hidesWhenStopped = true
        headerStack.addArrangedSubview(kindIcon)
        headerStack.addArrangedSubview(kindLabel)
        headerStack.addArrangedSubview(timeLabel)
        headerStack.addArrangedSubview(UIView())
        headerStack.addArrangedSubview(activity)

        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.font = .preferredFont(forTextStyle: .callout)
        titleLabel.textColor = .label
        titleLabel.numberOfLines = 5
        titleLabel.textAlignment = .left
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
        subtitleLabel.font = .preferredFont(forTextStyle: .caption2)
        subtitleLabel.textColor = .systemBlue
        subtitleLabel.lineBreakMode = .byTruncatingMiddle
        imageView.translatesAutoresizingMaskIntoConstraints = false
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        imageView.tintColor = .secondaryLabel
        imageView.backgroundColor = UIColor.systemOrange.withAlphaComponent(0.12)
        imagePlaceholderView.translatesAutoresizingMaskIntoConstraints = false
        imagePlaceholderView.contentMode = .center
        imagePlaceholderView.clipsToBounds = true
        imagePlaceholderView.tintColor = .secondaryLabel
        imagePlaceholderView.backgroundColor = UIColor.systemOrange.withAlphaComponent(0.12)
        imagePlaceholderView.image = UIImage(
            systemName: "photo",
            withConfiguration: UIImage.SymbolConfiguration(pointSize: 28, weight: .medium)
        )
        imageEdgeShadeView.translatesAutoresizingMaskIntoConstraints = false

        actedOverlay.translatesAutoresizingMaskIntoConstraints = false
        actedOverlay.backgroundColor = KeyboardSurface.itemUIColor.withAlphaComponent(0.94)
        actedOverlay.accessibilityIdentifier = "keyboard.actedOverlay"
        actedOverlay.isHidden = true
        actedIcon.translatesAutoresizingMaskIntoConstraints = false
        actedIcon.accessibilityIdentifier = "keyboard.actedIcon"
        actedIcon.contentMode = .scaleAspectFit
        actedIcon.tintColor = .systemGreen
        actedIcon.image = UIImage(
            systemName: "checkmark.circle.fill",
            withConfiguration: UIImage.SymbolConfiguration(pointSize: 30, weight: .semibold)
        )
        actedOverlay.addSubview(actedIcon)

        [imageView, imagePlaceholderView, imageEdgeShadeView, headerStack, titleLabel, subtitleLabel, actedOverlay]
            .forEach(contentView.addSubview)
        NSLayoutConstraint.activate([
            headerStack.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 12),
            headerStack.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -12),
            headerStack.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 12),
            headerStack.heightAnchor.constraint(equalToConstant: 20),
            titleLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 12),
            titleLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -12),
            titleLabel.topAnchor.constraint(equalTo: headerStack.bottomAnchor, constant: 8),
            titleLabel.bottomAnchor.constraint(lessThanOrEqualTo: contentView.bottomAnchor, constant: -12),
            subtitleLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 12),
            subtitleLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -12),
            subtitleLabel.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -12),
            imageView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            imageView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            imageView.topAnchor.constraint(equalTo: contentView.topAnchor),
            imageView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
            imagePlaceholderView.leadingAnchor.constraint(equalTo: imageView.leadingAnchor),
            imagePlaceholderView.trailingAnchor.constraint(equalTo: imageView.trailingAnchor),
            imagePlaceholderView.topAnchor.constraint(equalTo: imageView.topAnchor),
            imagePlaceholderView.bottomAnchor.constraint(equalTo: imageView.bottomAnchor),
            imageEdgeShadeView.leadingAnchor.constraint(equalTo: imageView.leadingAnchor),
            imageEdgeShadeView.trailingAnchor.constraint(equalTo: imageView.trailingAnchor),
            imageEdgeShadeView.topAnchor.constraint(equalTo: imageView.topAnchor),
            imageEdgeShadeView.bottomAnchor.constraint(equalTo: imageView.bottomAnchor),
            actedOverlay.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            actedOverlay.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            actedOverlay.topAnchor.constraint(equalTo: contentView.topAnchor),
            actedOverlay.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
            actedIcon.centerXAnchor.constraint(equalTo: actedOverlay.centerXAnchor),
            actedIcon.centerYAnchor.constraint(equalTo: actedOverlay.centerYAnchor),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func prepareForReuse() {
        super.prepareForReuse()
        thumbnailTask?.cancel()
        thumbnailTask = nil
        representedID = nil
        thumbnailRequest = nil
        imageView.image = nil
        imageView.isHidden = true
        imagePlaceholderView.isHidden = true
        imageEdgeShadeView.isHidden = true
        activity.stopAnimating()
        actedOverlay.layer.removeAllAnimations()
        actedOverlay.alpha = 0
        actedOverlay.transform = .identity
        actedOverlay.isHidden = true
    }

    func configure(
        card: KeyboardViewCard,
        loadThumbnail: @escaping (UUID, CGFloat) async -> KeyboardViewThumbnail?
    ) {
        let nextThumbnailRequest = KeyboardThumbnailRequest(cardID: card.id, version: card.thumbnailVersion)
        let retainsThumbnail = !nextThumbnailRequest.requiresReload(from: thumbnailRequest)
        representedID = card.id
        thumbnailRequest = card.kind == .image ? nextThumbnailRequest : nil
        timeLabel.text = card.time
        titleLabel.text = card.title
        subtitleLabel.text = card.subtitle.map { "⌁ \($0)" }
        activity.setAnimating(card.isActing)
        renderActedFeedback(card.didAct)

        let symbol: String
        let tint: UIColor
        switch card.kind {
        case .text:
            symbol = "text.alignleft"
            tint = .secondaryLabel
        case .link:
            symbol = "link"
            tint = .systemBlue
        case .image:
            symbol = "photo"
            tint = .systemOrange
        }
        kindIcon.image = UIImage(systemName: symbol)
        kindIcon.tintColor = tint
        kindLabel.text = card.kindTitle
        kindLabel.textColor = tint
        timeLabel.textColor = .tertiaryLabel
        headerStack.isHidden = card.kind == .image
        subtitleLabel.isHidden = card.kind != .link
        imageView.isHidden = card.kind != .image || imageView.image == nil
        imagePlaceholderView.isHidden = card.kind != .image || imageView.image != nil
        imageEdgeShadeView.isHidden = card.kind != .image
        titleLabel.isHidden = card.kind == .image

        guard card.kind == .image else {
            thumbnailTask?.cancel()
            thumbnailTask = nil
            return
        }
        guard !retainsThumbnail else { return }
        thumbnailTask?.cancel()
        thumbnailTask = nil
        imageView.image = nil
        imageView.isHidden = true
        imagePlaceholderView.isHidden = false
        thumbnailTask = Task { @MainActor [weak self] in
            let image = await loadThumbnail(card.id, 220)
            guard !Task.isCancelled, self?.representedID == card.id else { return }
            self?.imageView.image = image
            self?.imageView.isHidden = image == nil
            self?.imagePlaceholderView.isHidden = image != nil
        }
    }

    private func renderActedFeedback(_ visible: Bool) {
        if visible {
            guard actedOverlay.isHidden else { return }
            actedOverlay.layer.removeAllAnimations()
            actedOverlay.isHidden = false
            actedOverlay.alpha = 0
            actedOverlay.transform = CGAffineTransform(scaleX: 0.9, y: 0.9)
            UIView.animate(
                withDuration: 0.18,
                delay: 0,
                options: [.curveEaseOut, .beginFromCurrentState]
            ) {
                self.actedOverlay.alpha = 1
                self.actedOverlay.transform = .identity
            }
            return
        }

        guard !actedOverlay.isHidden else { return }
        UIView.animate(
            withDuration: 0.28,
            delay: 0,
            options: [.curveEaseInOut, .beginFromCurrentState]
        ) {
            self.actedOverlay.alpha = 0
            self.actedOverlay.transform = CGAffineTransform(scaleX: 0.94, y: 0.94)
        } completion: { finished in
            guard finished else { return }
            self.actedOverlay.isHidden = true
            self.actedOverlay.transform = .identity
        }
    }
}

extension UIActivityIndicatorView {
    func setAnimating(_ animating: Bool) {
        animating ? startAnimating() : stopAnimating()
    }
}
