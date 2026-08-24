import UIKit

private final class KeyboardExpandedHitAreaView: UIView {
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        bounds.insetBy(dx: -6, dy: -6).contains(point)
    }
}

private final class KeyboardExpandedHitButton: UIButton {
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        bounds.insetBy(dx: -6, dy: -6).contains(point)
    }
}

@MainActor
final class KeyboardTopBarView: UIView {
    var onRefresh: (() -> Void)?
    var onFilterPresentationChange: ((KeyboardFilterPresentation) -> Void)?
    var onFeedback: (() -> Void)?

    private let standardBar = KeyboardExpandedHitAreaView()
    private let filterBar = UIView()
    private let searchButton = KeyboardExpandedHitButton(type: .system)
    private let refreshButton = KeyboardExpandedHitButton(type: .system)
    private let refreshSpinner = UIActivityIndicatorView(style: .medium)
    private let closeFilterButton = UIButton(type: .system)
    private let filterControl = UISegmentedControl(items: [])
    private var filterPresentation = KeyboardFilterPresentation(isFiltering: false, filter: .all)

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        buildHierarchy()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func render(
        topBar: KeyboardViewState.TopBar,
        strings: KeyboardViewState.Strings,
        sync: KeyboardViewState.Sync,
        filterPresentation: KeyboardFilterPresentation
    ) {
        self.filterPresentation = filterPresentation
        searchButton.accessibilityLabel = strings.searchLabel
        refreshButton.accessibilityLabel = strings.refreshLabel
        closeFilterButton.accessibilityLabel = strings.closeFilterLabel
        rebuildFilterSegments(strings.filterTitles)

        searchButton.isHidden = !topBar.showsSearch
        renderSync(sync, showsRefresh: topBar.showsRefresh)

        standardBar.isHidden = filterPresentation.isFiltering
        filterBar.isHidden = !filterPresentation.isFiltering
    }

    private func buildHierarchy() {
        [standardBar, filterBar].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            addSubview($0)
            NSLayoutConstraint.activate([
                $0.leadingAnchor.constraint(equalTo: leadingAnchor, constant: KeyboardLayoutMetrics.hMargin),
                $0.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -KeyboardLayoutMetrics.hMargin),
                $0.topAnchor.constraint(equalTo: topAnchor, constant: KeyboardLayoutMetrics.topBarVPad),
                $0.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -KeyboardLayoutMetrics.topBarVPad),
            ])
        }

        configureIconButton(
            searchButton,
            symbol: "magnifyingglass",
            symbolSize: 14,
            width: 34,
            height: 34,
            circularBackground: true
        )
        searchButton.accessibilityIdentifier = "keyboard.searchButton"
        configureIconButton(
            refreshButton,
            symbol: "arrow.clockwise",
            symbolSize: 14,
            width: 34,
            height: 34,
            circularBackground: true
        )
        refreshButton.accessibilityIdentifier = "keyboard.refreshButton"
        configureIconButton(closeFilterButton, symbol: "xmark")
        searchButton.addTarget(self, action: #selector(openFilter), for: .touchUpInside)
        refreshButton.addTarget(self, action: #selector(refresh), for: .touchUpInside)
        closeFilterButton.addTarget(self, action: #selector(closeFilter), for: .touchUpInside)

        refreshSpinner.translatesAutoresizingMaskIntoConstraints = false
        refreshSpinner.hidesWhenStopped = true
        standardBar.addSubview(searchButton)
        standardBar.addSubview(refreshButton)
        standardBar.addSubview(refreshSpinner)
        NSLayoutConstraint.activate([
            searchButton.leadingAnchor.constraint(equalTo: standardBar.leadingAnchor),
            searchButton.centerYAnchor.constraint(equalTo: standardBar.centerYAnchor),
            refreshButton.trailingAnchor.constraint(equalTo: standardBar.trailingAnchor),
            refreshButton.centerYAnchor.constraint(equalTo: standardBar.centerYAnchor),
            refreshSpinner.centerXAnchor.constraint(equalTo: refreshButton.centerXAnchor),
            refreshSpinner.centerYAnchor.constraint(equalTo: refreshButton.centerYAnchor),
        ])

        closeFilterButton.translatesAutoresizingMaskIntoConstraints = false
        filterControl.translatesAutoresizingMaskIntoConstraints = false
        filterControl.addTarget(self, action: #selector(filterChanged), for: .valueChanged)
        filterBar.addSubview(closeFilterButton)
        filterBar.addSubview(filterControl)
        NSLayoutConstraint.activate([
            closeFilterButton.leadingAnchor.constraint(equalTo: filterBar.leadingAnchor),
            closeFilterButton.centerYAnchor.constraint(equalTo: filterBar.centerYAnchor),
            filterControl.leadingAnchor.constraint(equalTo: closeFilterButton.trailingAnchor, constant: 8),
            filterControl.trailingAnchor.constraint(lessThanOrEqualTo: filterBar.trailingAnchor),
            filterControl.centerYAnchor.constraint(equalTo: filterBar.centerYAnchor),
        ])
        filterBar.isHidden = true
    }

    private func renderSync(_ presentation: KeyboardViewState.Sync, showsRefresh: Bool) {
        if presentation.isSyncing {
            refreshButton.isHidden = true
            refreshSpinner.isHidden = false
            refreshSpinner.startAnimating()
            return
        }
        refreshSpinner.stopAnimating()
        refreshButton.isHidden = !showsRefresh
        let symbol: String
        let color: UIColor
        switch presentation.flash {
        case .success:
            symbol = "checkmark.circle.fill"
            color = .systemGreen
        case .failure:
            symbol = "exclamationmark.circle.fill"
            color = .systemOrange
        case nil:
            symbol = "arrow.clockwise"
            color = .secondaryLabel
        }
        refreshButton.setImage(UIImage(systemName: symbol), for: .normal)
        refreshButton.tintColor = color
    }

    private func rebuildFilterSegments(_ titles: [String]) {
        filterControl.removeAllSegments()
        for (index, title) in titles.enumerated() {
            filterControl.insertSegment(withTitle: title, at: index, animated: false)
        }
        filterControl.selectedSegmentIndex = filterPresentation.filter.rawValue
    }

    private func configureIconButton(
        _ button: UIButton,
        symbol: String,
        symbolSize: CGFloat = 16,
        width: CGFloat = 34,
        height: CGFloat = 34,
        circularBackground: Bool = false
    ) {
        button.translatesAutoresizingMaskIntoConstraints = false
        button.setImage(UIImage(systemName: symbol), for: .normal)
        button.tintColor = .secondaryLabel
        button.imageView?.preferredSymbolConfiguration = UIImage.SymbolConfiguration(
            pointSize: symbolSize,
            weight: .medium
        )
        if circularBackground {
            button.backgroundColor = KeyboardSurface.itemUIColor
            button.layer.cornerRadius = height / 2
            button.layer.cornerCurve = .continuous
        }
        NSLayoutConstraint.activate([
            button.widthAnchor.constraint(equalToConstant: width),
            button.heightAnchor.constraint(equalToConstant: height),
        ])
    }

    @objc private func openFilter() {
        onFeedback?()
        onFilterPresentationChange?(KeyboardFilterPresentation(
            isFiltering: true,
            filter: filterPresentation.filter
        ))
    }

    @objc private func closeFilter() {
        onFeedback?()
        onFilterPresentationChange?(KeyboardFilterPresentation(isFiltering: false, filter: .all))
    }

    @objc private func filterChanged() {
        onFeedback?()
        let filter = KeyboardCardFilter(rawValue: filterControl.selectedSegmentIndex) ?? .all
        onFilterPresentationChange?(KeyboardFilterPresentation(isFiltering: true, filter: filter))
    }

    @objc private func refresh() { onRefresh?() }
}
